import axios from 'axios'

const http = axios.create({
  baseURL: '/api',
  timeout: 120000,
})

http.interceptors.response.use(
  (r) => r.data,
  (err) => {
    const msg = err.response?.data?.detail || err.message || 'Request failed'
    return Promise.reject(new Error(msg))
  }
)

export const api = {
  health: () => http.get('/health'),

  upload: (file) => {
    const form = new FormData()
    form.append('file', file)
    return http.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },

  getProducts:  (sessionId)               => http.get(`/products/${sessionId}`),
  forecast:     (sessionId, store, item, horizon) =>
                  http.post('/forecast', { session_id: sessionId, store, item, horizon }),
  getResults:   (sessionId)               => http.get(`/results?session_id=${sessionId}`),
  getResult:    (forecastId)              => http.get(`/results/${forecastId}`),
  deleteResult: (forecastId)              => http.delete(`/results/${forecastId}`),

  // ── NEW: email export ──────────────────────────────────────────────────────
  // POST /send-email  { session_id, email }
  sendEmail: (sessionId, email) =>
    http.post('/send-email', { session_id: sessionId, email }),

  // ── NEW: session insights ──────────────────────────────────────────────────
  // GET /insights/{session_id}
  getInsights: (sessionId) =>
    http.get(`/insights/${sessionId}`),
}