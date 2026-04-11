import { useState } from 'react'
import { api } from '../api/client'

export function useUpload() {
  const [status, setStatus]       = useState('idle')  // idle | uploading | success | error
  const [summary, setSummary]     = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [error, setError]         = useState(null)

  const upload = async (file) => {
    setStatus('uploading')
    setError(null)
    try {
      const data = await api.upload(file)
      setSessionId(data.session_id)
      setSummary(data)
      setStatus('success')
      return data
    } catch (err) {
      setError(err.message)
      setStatus('error')
      throw err
    }
  }

  const reset = () => {
    setStatus('idle')
    setSummary(null)
    setSessionId(null)
    setError(null)
  }

  return { status, summary, sessionId, error, upload, reset }
}
