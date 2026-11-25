from __future__ import annotations

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send_smtp(to: str, subject: str, body: str) -> None:
    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        logger.info("Email delivery is disabled")
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5) as client:
            client.starttls(context=ssl.create_default_context())
            if settings.SMTP_USER:
                client.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            client.send_message(msg)
    except (OSError, smtplib.SMTPException):
        logger.warning("Email delivery failed")


async def send_email(to: str, subject: str, body: str) -> None:
    await asyncio.to_thread(_send_smtp, to, subject, body)


async def send_verification_email(email: str, token: str) -> None:
    verify_url = f"{settings.APP_URL.rstrip('/')}/verify-email?token={token}"
    subject = "Verify your email address"
    body = (
        f"Welcome to {settings.PROJECT_NAME}!\n\n"
        f"Please verify your email by clicking the link below:\n\n"
        f"{verify_url}\n\n"
        f"This link expires in 24 hours.\n\n"
        f"If you did not sign up, please ignore this email."
    )
    await send_email(email, subject, body)


async def send_password_reset(email: str, token: str) -> None:
    reset_url = f"{settings.APP_URL.rstrip('/')}/reset-password?token={token}"
    subject = "Reset your password"
    body = (
        f"You requested a password reset for {settings.PROJECT_NAME}.\n\n"
        f"Click the link below to reset your password:\n\n"
        f"{reset_url}\n\n"
        f"This link expires in 1 hour.\n\n"
        f"If you did not request this, please ignore this email."
    )
    await send_email(email, subject, body)
