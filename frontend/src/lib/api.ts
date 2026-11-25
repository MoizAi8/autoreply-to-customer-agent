import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { getToken, getRefreshToken, setToken, setRefreshToken, removeToken, removeRefreshToken } from './auth'
import type {
  User, BrandVoice, Review, Reply, DashboardStats,
  SentimentTrend, PlatformPerformance, MonthlyActivity, PlatformConnection,
  PaginatedResponse
} from '@/types'

export function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error) && typeof error.response?.data?.detail === 'string') return error.response.data.detail
  return fallback
}

type DraftOptions = {
  tone?: 'professional' | 'friendly' | 'formal' | 'empathetic' | 'concise'
  length?: 'short' | 'medium' | 'long'
}

export type ReviewFilters = {
  page?: number
  page_size?: number
  sentiment?: string
  platform?: string
  rating?: number
  risk_level?: string
  search?: string
  sort_by?: string
  sort_order?: string
  date_from?: string
  date_to?: string
  response_status?: string
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 100000,
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !['/auth/login', '/auth/mfa/login'].includes(originalRequest.url ?? '')) {
      originalRequest._retry = true
      try {
        const refreshToken = getRefreshToken()
        if (!refreshToken) throw new Error('No refresh token')
        const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refresh_token: refreshToken })
        setToken(data.access_token)
        setRefreshToken(data.refresh_token)
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`
        }
        return api(originalRequest)
      } catch {
        removeToken()
        removeRefreshToken()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export type SessionTokens = { user_id: string; access_token: string; refresh_token: string; token_type: string }
type LoginResult = SessionTokens | { requires_mfa: true; challenge_token: string }

export async function login(email: string, password: string): Promise<LoginResult> {
  const { data } = await api.post('/auth/login', { email, password })
  return data.data
}

export async function completeMfa(challenge_token: string, code: string): Promise<SessionTokens> {
  const { data } = await api.post('/auth/mfa/login', { challenge_token, code })
  return data.data
}

export async function signup(data: {
  business_name: string
  full_name: string
  email: string
  password: string
}): Promise<{ user: User; message: string }> {
  const { data: res } = await api.post('/auth/register', data)
  return res.data
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  const { data } = await api.post('/auth/verify-email', { token })
  return data
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const { data } = await api.post('/auth/forgot-password', { email })
  return data
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  const { data } = await api.post('/auth/reset-password', { token, password })
  return data
}

export async function getMe(): Promise<User> {
  const { data } = await api.get('/auth/me')
  return data.data
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get('/analytics/dashboard')
  return data
}

export async function getSentimentTrends(days?: number): Promise<SentimentTrend[]> {
  const { data } = await api.get('/analytics/sentiment-trends', { params: days ? { days } : undefined })
  return data
}

export async function getPlatformPerformance(): Promise<PlatformPerformance[]> {
  const { data } = await api.get('/analytics/platform-performance')
  return data
}

export async function getMonthlyActivity(months?: number): Promise<MonthlyActivity[]> {
  const { data } = await api.get('/analytics/monthly-activity', { params: months ? { months } : undefined })
  return data
}

export async function getReviews(params?: ReviewFilters): Promise<PaginatedResponse<Review>> {
  const { data } = await api.get('/reviews/', { params })
  return data
}

export async function getReview(id: string): Promise<Review> {
  const { data } = await api.get(`/reviews/${id}`)
  return data
}

export async function createReview(review: { customer_name?: string; rating: number; title?: string; content: string; review_date?: string }): Promise<Review> {
  const { data } = await api.post('/reviews/', review)
  return data
}

export async function importReviews(csv: string): Promise<{ imported: number; duplicates: number; errors: { row: number; message: string }[] }> {
  const { data } = await api.post('/reviews/import', { csv })
  return data
}

export async function saveDraft(reviewId: string, content: string): Promise<Reply> {
  const { data } = await api.put('/reviews/' + reviewId + '/draft', { content })
  return data
}

export async function getReviewHistory(reviewId: string): Promise<{ id: string; action: string; created_at: string }[]> {
  const { data } = await api.get('/reviews/' + reviewId + '/history')
  return data
}

export async function getWorkflowStatus(): Promise<{ ai_enabled: boolean; awaiting_approval: number; generated: number }> {
  const { data } = await api.get('/reviews/workflow')
  return data
}

export async function generateReply(reviewId: string, options?: DraftOptions): Promise<{ reply_id: string; content: string }> {
  const { data } = await api.post('/reviews/' + reviewId + '/generate-reply', options)
  return data.data
}

export async function updateReply(replyId: string, content: string): Promise<Reply> {
  const { data } = await api.patch(`/replies/${replyId}`, { content })
  return data
}

export async function approveReply(replyId: string): Promise<Reply> {
  const { data } = await api.post(`/replies/${replyId}/approve`)
  return data
}

export async function rejectReply(replyId: string, reason = 'Rejected by reviewer'): Promise<Reply> {
  const { data } = await api.post(`/replies/${replyId}/reject`, { reason })
  return data
}

export async function publishReply(replyId: string): Promise<Reply> {
  const { data } = await api.post(`/replies/${replyId}/publish`)
  return data
}

export async function regenerateReply(replyId: string, options?: DraftOptions): Promise<{ reply_id: string; content: string }> {
  const { data } = await api.post(`/replies/${replyId}/regenerate`, options)
  return data.data
}

export async function flagReview(reviewId: string, reason: string): Promise<Review> {
  const { data } = await api.patch(`/reviews/${reviewId}/flag`, { reason })
  return data
}

export async function getBrandVoice(): Promise<BrandVoice> {
  const { data } = await api.get('/brand/')
  return data
}

export async function updateBrandVoice(bv: Partial<BrandVoice>): Promise<BrandVoice> {
  const { data } = await api.patch('/brand/', bv)
  return data
}

export async function getAdminUsers(): Promise<any> {
  const { data } = await api.get('/admin/users')
  return data
}

export async function getAdminBusinesses(): Promise<any> {
  const { data } = await api.get('/admin/businesses')
  return data
}

export async function getAuditLogs(params?: { page?: number; page_size?: number }): Promise<PaginatedResponse<any>> {
  const { data } = await api.get('/admin/audit-logs', { params })
  return data
}

export async function getUsageMetrics(): Promise<any> {
  const { data } = await api.get('/admin/usage')
  return data
}

export async function getAdminHealth(): Promise<Record<string, unknown>> {
  const { data } = await api.get('/admin/health')
  return data
}

export async function getPlatforms(): Promise<PlatformConnection[]> {
  const { data } = await api.get('/platforms')
  return data
}

export async function connectPlatform(platform: string, credentials?: Record<string, any>): Promise<PlatformConnection> {
  const { data } = await api.post('/platforms/connect', { platform, ...credentials })
  return data
}

export async function disconnectPlatform(id: string): Promise<void> {
  await api.post(`/platforms/${id}/disconnect`)
}

export async function changePassword(current_password: string, new_password: string): Promise<void> {
  await api.post('/auth/change-password', { current_password, new_password })
}

export default api
