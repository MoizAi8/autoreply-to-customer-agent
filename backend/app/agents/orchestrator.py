from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, NamedTuple, Optional
from uuid import UUID, uuid4

from openai import APIConnectionError, APIStatusError, AsyncOpenAI, RateLimitError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.reply import Reply
from app.models.review import Review
from app.models.business import Business
from app.models.brand_voice import BrandVoice
from app.models.usage import UsageMetric
from app.schemas.drafting import DraftLanguage
from app.agents.provider import analyze_review, create_provider_client
from app.agents.input_validation_agent import InputValidationAgent
from app.agents.language_detection_agent import LanguageDetectionAgent
from app.agents.intent_detection_agent import IntentDetectionAgent
from app.agents.sentiment_agent import SentimentAnalysisAgent
from app.agents.risk_classification_agent import RiskClassificationAgent
from app.agents.knowledge_retrieval_agent import KnowledgeRetrievalAgent
from app.agents.reply_generation_agent import ReplyGenerationAgent
from app.agents.safety_guardrail_agent import SafetyGuardrailAgent
from app.agents.quality_evaluation_agent import QualityEvaluationAgent
from app.services.brand_service import BrandVoiceService
from app.services.knowledge_service import KnowledgeService
from app.services.audit_service import AuditService
from app.services.workflow_service import ApprovalWorkflowService
from app.utils.helpers import calculate_cost, now

logger = logging.getLogger(__name__)

AGENT_TIMEOUT_SECONDS = 18
MAX_RETRIES = 0


async def _with_provider_retry(operation, *args, **kwargs):
    for attempt in range(2):
        try:
            return await operation(*args, **kwargs)
        except RateLimitError:
            raise
        except (APIConnectionError, APIStatusError) as exc:
            if attempt or (isinstance(exc, APIStatusError) and exc.status_code < 500):
                raise
            await asyncio.sleep(0.5)


class GenerationUnavailable(ValueError):
    pass


class GenerationRateLimited(GenerationUnavailable):
    pass


class GenerationConflict(ValueError):
    pass


class ReviewNotFound(ValueError):
    pass


class OrchestrationResult(NamedTuple):
    reply: Reply
    all_scores: dict[str, Any]
    decisions: dict[str, Any]
    pipeline_log: list[dict[str, Any]]


class AIOrchestrator:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.openai_client = create_provider_client()

        self.input_validator = InputValidationAgent()
        self.language_detector = LanguageDetectionAgent()
        self.intent_detector = IntentDetectionAgent(self.openai_client)
        self.sentiment_analyzer = SentimentAnalysisAgent(self.openai_client)
        self.risk_classifier = RiskClassificationAgent()
        self.knowledge_service = KnowledgeService(db)
        self.brand_service = BrandVoiceService(db)
        self.knowledge_retriever = KnowledgeRetrievalAgent(self.knowledge_service)
        self.reply_generator = ReplyGenerationAgent(self.openai_client)
        self.safety_guardrail = SafetyGuardrailAgent(self.openai_client)
        self.quality_evaluator = QualityEvaluationAgent(self.openai_client)
        self.audit_service = AuditService(db)
        self.workflow_service = ApprovalWorkflowService(db)

    async def _load_entities(
        self, business_id: UUID, review_id: UUID
    ) -> tuple[Review, Business, BrandVoice]:
        review_result = await self.db.execute(
            select(Review).where(Review.id == review_id, Review.business_id == business_id).with_for_update()
        )
        review = review_result.scalar_one_or_none()
        if not review:
            raise ReviewNotFound("Review not found")

        business_result = await self.db.execute(
            select(Business).where(Business.id == business_id)
        )
        business = business_result.scalar_one_or_none()
        if not business:
            raise ValueError(f"Business {business_id} not found")

        brand = await self.brand_service.get_brand_voice(business_id)

        return review, business, brand

    async def _log_usage(
        self, business_id: UUID, metric_type: str, model: str,
        prompt_tokens: int, completion_tokens: int, duration_ms: int,
    ) -> None:
        total_tokens = prompt_tokens + completion_tokens
        cost = calculate_cost(model, prompt_tokens, completion_tokens)

        usage = UsageMetric(
            id=uuid4(),
            business_id=business_id,
            metric_type=metric_type,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            cost=cost,
            duration_ms=duration_ms,
            extra_data={"source": "orchestrator"},
        )
        self.db.add(usage)

    async def _run_agent_step(
        self, step_name: str, agent_fn, *args, max_retries: int = MAX_RETRIES, **kwargs
    ) -> dict[str, Any]:
        last_error = None
        for attempt in range(1 + max_retries):
            try:
                step_start = time.monotonic()
                result = await asyncio.wait_for(
                    agent_fn(*args, **kwargs), timeout=AGENT_TIMEOUT_SECONDS
                )
                duration_ms = int((time.monotonic() - step_start) * 1000)
                return {
                    "step": step_name,
                    "status": "success",
                    "attempt": attempt + 1,
                    "duration_ms": duration_ms,
                    "result": result,
                }
            except (RateLimitError, APIStatusError) as exc:
                if isinstance(exc, RateLimitError):
                    last_error = "RateLimitError"
                elif exc.status_code in (401, 403):
                    last_error = "ProviderAuthorizationError"
                else:
                    last_error = type(exc).__name__
                break
            except asyncio.TimeoutError:
                last_error = f"Timeout ({AGENT_TIMEOUT_SECONDS}s)"
                logger.warning("%s timeout on attempt %d/%d", step_name, attempt + 1, 1 + max_retries)
            except Exception as exc:
                last_error = type(exc).__name__
                logger.warning("%s failed on attempt %d/%d (%s)", step_name, attempt + 1, 1 + max_retries, last_error)
                if attempt < max_retries:
                    await asyncio.sleep(2 ** attempt)
        return {
            "step": step_name,
            "status": "failed",
            "attempt": 1 + max_retries,
            "duration_ms": 0,
            "error": last_error,
            "result": None,
        }

    @staticmethod
    def _provider_error(step: dict[str, Any], operation: str) -> None:
        if step.get("error") == "RateLimitError":
            raise GenerationRateLimited("The AI provider quota is exhausted. Try again after the quota resets.")
        if step.get("error") == "ProviderAuthorizationError":
            raise GenerationUnavailable("The AI provider rejected its server configuration.")
        raise GenerationUnavailable(f"The AI provider could not {operation}. Try again later.")

    async def process_review(
        self,
        business_id: UUID,
        review_id: UUID,
        custom_instructions: Optional[str] = None,
        reuse_existing: bool = False,
        requested_language: DraftLanguage | None = None,
    ) -> OrchestrationResult:
        pipeline_log: list[dict[str, Any]] = []
        start_time = time.monotonic()

        review, business, brand = await self._load_entities(business_id, review_id)
        existing_reply = await self.db.scalar(
            select(Reply).where(Reply.review_id == review_id, Reply.business_id == business_id).with_for_update()
        )
        if reuse_existing and existing_reply:
            metadata = existing_reply.ai_metadata or {}
            return OrchestrationResult(existing_reply, {}, metadata.get("decisions", {}), metadata.get("pipeline_log", []))
        if existing_reply and existing_reply.status == "published":
            raise GenerationConflict("Published responses cannot be regenerated")
        if not settings.ai_ready:
            raise GenerationUnavailable("Live AI drafting is disabled for this deployment")

        # Step 1: Input Validation
        step = await self._run_agent_step("input_validation", self.input_validator.validate,
                                          {"content": review.content, "rating": review.rating})
        validation_result = step.get("result")
        review_text = review.content
        if validation_result and hasattr(validation_result, "clean_text") and validation_result.clean_text:
            review_text = validation_result.clean_text
        risk_flags = validation_result.risk_flags if validation_result and hasattr(validation_result, "risk_flags") else []
        is_valid = bool(validation_result and validation_result.is_valid)
        pipeline_log.append(step)
        if not is_valid:
            raise ValueError("This review needs manual handling before AI drafting")

        if settings.AI_PROVIDER == "gemini":
            step = await self._run_agent_step(
                "feedback_analysis", _with_provider_retry, analyze_review, self.openai_client, review_text, review.rating,
            )
            pipeline_log.append(step)
            analysis = step["result"]
            if analysis is None:
                self._provider_error(step, "analyze this review")
            review.language = analysis.language
            review.intent = intent = analysis.intent
            review.sentiment = sentiment = analysis.sentiment
            review.sentiment_score = intent_confidence = sentiment_confidence = analysis.confidence
            sub_intent = "general"
            urgency = "medium"
        else:
            # Step 2: Language Detection
            step = await self._run_agent_step("language_detection", self.language_detector.detect, review_text)
            ld_result = step.get("result")
            if ld_result and hasattr(ld_result, "language_code"):
                review.language = ld_result.language_code
            pipeline_log.append(step)

            # Step 3: Intent Detection
            step = await self._run_agent_step("intent_detection", self.intent_detector.detect,
                                              review_text, review.title, review.platform, review.rating)
            id_result = step.get("result")
            intent = "general_inquiry"
            intent_confidence = 0.0
            sub_intent = "general"
            urgency = "medium"
            if id_result and hasattr(id_result, "intent"):
                intent = id_result.intent
                intent_confidence = id_result.confidence
                sub_intent = id_result.sub_intent
                urgency = id_result.urgency
            review.intent = intent
            pipeline_log.append(step)

            # Step 4: Sentiment Analysis
            step = await self._run_agent_step("sentiment_analysis", self.sentiment_analyzer.analyze, review_text, review.rating)
            sa_result = step.get("result")
            if sa_result and hasattr(sa_result, "sentiment"):
                review.sentiment = sa_result.sentiment
                review.sentiment_score = sa_result.confidence if hasattr(sa_result, "confidence") else 0.0
            sentiment = sa_result.sentiment if sa_result and hasattr(sa_result, "sentiment") else "neutral"
            sentiment_confidence = sa_result.confidence if sa_result and hasattr(sa_result, "confidence") else 0.5
            sentiment_reasoning = sa_result.reasoning if sa_result and hasattr(sa_result, "reasoning") else ""
            pipeline_log.append(step)

        # Step 5: Risk Classification
        step = await self._run_agent_step("risk_classification", self.risk_classifier.classify,
                                          review_text, review.rating, sentiment, review.platform,
                                          business.industry or "General")
        rc_result = step.get("result")
        risk_level = "medium"
        risk_factors = []
        needs_human = True
        if rc_result and hasattr(rc_result, "risk_level"):
            risk_level = rc_result.risk_level
            risk_factors = rc_result.risk_factors if hasattr(rc_result, "risk_factors") else []
            needs_human = rc_result.needs_human_review if hasattr(rc_result, "needs_human_review") else True
        review.risk_level = risk_level
        pipeline_log.append(step)

        # Step 6: Knowledge Retrieval
        step = await self._run_agent_step("knowledge_retrieval", self.knowledge_retriever.retrieve,
                                          business_id, review_text, review.rating, sentiment)
        kr_result = step.get("result")
        brand_context = ""
        relevant_docs = []
        if kr_result and hasattr(kr_result, "brand_context"):
            brand_context = kr_result.brand_context
            relevant_docs = kr_result.relevant_docs if hasattr(kr_result, "relevant_docs") else []
        pipeline_log.append(step)

        # Step 7: Reply Generation
        step = await self._run_agent_step(
            "reply_generation", _with_provider_retry, self.reply_generator.generate,
            business, review, brand, brand_context, custom_instructions, risk_level,
            requested_language=requested_language,
        )
        pipeline_log.append(step)
        gen_result = step["result"]
        if gen_result is None:
            self._provider_error(step, "return a complete draft")
        reply_text = gen_result.reply_text
        gen_raw = gen_result.raw_response

        # Step 8: Safety Guardrail
        step = await self._run_agent_step("safety_guardrail", self.safety_guardrail.check,
                                          reply_text, review_text, brand_context)
        sg_result = step.get("result")
        is_safe = bool(sg_result and sg_result.is_safe)
        safety_score = sg_result.safety_score if sg_result else 0.0
        violations = sg_result.violations if sg_result and hasattr(sg_result, "violations") else []
        pipeline_log.append(step)

        if settings.AI_PROVIDER == "gemini":
            quality_score = None
            quality_breakdown = {}
            passes_threshold = True
        else:
            # Step 9: Quality Evaluation
            step = await self._run_agent_step("quality_evaluation", self.quality_evaluator.evaluate,
                                              reply_text, review, brand, brand_context)
            qe_result = step.get("result")
            quality_score = qe_result.overall_score if qe_result and hasattr(qe_result, "overall_score") else 50.0
            quality_breakdown = qe_result.breakdown if qe_result and hasattr(qe_result, "breakdown") else {}
            passes_threshold = qe_result.passes_threshold if qe_result and hasattr(qe_result, "passes_threshold") else False
            pipeline_log.append(step)

        # Use Workflow Service for decisions
        wf_decision = await self.workflow_service.decide(
            business_id=business_id,
            risk_level=risk_level,
            quality_score=quality_score or 0.0,
            safety_score=safety_score,
        )

        decisions: dict[str, Any] = {
            "route_to_human": True,
            "auto_approve": False,
            "reasons": wf_decision.get("reasons", []),
        }

        if needs_human or not is_safe or not passes_threshold or risk_flags:
            decisions["reasons"].append("manual_attention_required")
        reply_status = "pending_approval"
        events = [{key: value for key, value in step.items() if key != "result"} for step in pipeline_log]

        ai_meta = {
            "source": settings.AI_PROVIDER,
            "pipeline_log": events,
            "decisions": decisions,
            "intent": intent,
            "intent_confidence": intent_confidence,
            "sub_intent": sub_intent,
            "urgency": urgency,
            "sentiment": sentiment,
            "sentiment_confidence": sentiment_confidence,
            "risk_level": risk_level,
            "risk_factors": risk_factors,
            "language": review.language,
            "safety_violations": violations,
            "quality_breakdown": quality_breakdown,
            "generation_usage": gen_raw.get("usage"),
            "model": gen_raw.get("model", settings.ai_model),
        }

        if existing_reply:
            existing_reply.content = reply_text
            existing_reply.status = reply_status
            existing_reply.rejection_reason = None
            existing_reply.quality_score = quality_score / 100.0 if quality_score is not None else None
            existing_reply.safety_score = safety_score
            existing_reply.ai_metadata = ai_meta
            reply = existing_reply
        else:
            reply = Reply(
                id=uuid4(),
                business_id=business_id,
                review_id=review_id,
                content=reply_text,
                status=reply_status,
                quality_score=quality_score / 100.0 if quality_score is not None else None,
                safety_score=safety_score,
                ai_metadata=ai_meta,
            )
            self.db.add(reply)

        review.is_processed = True

        # Usage logging
        usage = gen_raw.get("usage", {})
        total_duration = int((time.monotonic() - start_time) * 1000)
        await self._log_usage(
            business_id=business_id,
            metric_type="ai_generation",
            model=gen_raw.get("model", settings.ai_model),
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            duration_ms=total_duration,
        )

        # Audit log
        await self.audit_service.log_ai_decision(
            business_id=business_id,
            review_id=review_id,
            action="process_review",
            details={
                "sentiment": sentiment,
                "risk_level": risk_level,
                "safety_score": safety_score,
                "quality_score": quality_score,
                "route_to_human": decisions["route_to_human"],
                "auto_approve": decisions["auto_approve"],
                "reasons": decisions["reasons"],
                "pipeline_steps": len(pipeline_log),
                "response_version": reply_text,
                "total_duration_ms": total_duration,
            },
        )

        await self.db.flush()

        return OrchestrationResult(
            reply=reply,
            all_scores={
                "sentiment_confidence": sentiment_confidence,
                "safety_score": safety_score,
                "quality_score": quality_score,
                "quality_breakdown": quality_breakdown,
            },
            decisions=decisions,
            pipeline_log=events,
        )
