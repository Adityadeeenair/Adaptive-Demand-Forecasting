import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Models from './pages/Models'
import Insights from './pages/Insights'
import { api } from './api/client'

export default function App() {
  const [sessionId, setSessionId] = useState(() => {
    try {
      return sessionStorage.getItem('adf_session_id') || null
    } catch (_) {
      return null
    }
  })
  const [summary, setSummary] = useState(() => {
    try {
      const raw = sessionStorage.getItem('adf_summary')
      return raw ? JSON.parse(raw) : null
    } catch (_) {
      return null
    }
  })
  const [lastForecast, setLastForecast] = useState(() => {
    try {
      const raw = sessionStorage.getItem('adf_last_forecast')
      return raw ? JSON.parse(raw) : null
    } catch (_) {
      return null
    }
  })
  const [apiStatus, setApiStatus] = useState('connecting')

  useEffect(() => {
    let interval = null

    const check = () => {
      api.health()
        .then(() => {
          setApiStatus('online')
          if (interval) clearInterval(interval)
        })
        .catch(() => {
          setApiStatus('waking_up')
        })
    }

    check()
    interval = setInterval(check, 6000)

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [])

  const handleSessionCreated = (id, sum) => {
    setSessionId(id)
    setSummary(sum)
    try {
      if (id) sessionStorage.setItem('adf_session_id', id)
      else sessionStorage.removeItem('adf_session_id')

      if (sum) sessionStorage.setItem('adf_summary', JSON.stringify(sum))
      else sessionStorage.removeItem('adf_summary')
    } catch (_) {}
  }

  const handleForecastUpdate = (fc) => {
    setLastForecast(fc)
    try {
      if (fc) sessionStorage.setItem('adf_last_forecast', JSON.stringify(fc))
      else sessionStorage.removeItem('adf_last_forecast')
    } catch (_) {}
  }

  return (
    <BrowserRouter>
      <Layout apiStatus={apiStatus}>
        <Routes>
          <Route path="/" element={
            <Landing
              hasSession={!!sessionId}
              onGoToDashboard={() => window.location.href = '/dashboard'}
            />
          } />

          <Route path="/upload" element={
            <Home onSessionCreated={handleSessionCreated} />
          } />

          <Route path="/dashboard" element={
            sessionId
              ? <Dashboard sessionId={sessionId} summary={summary} onForecastUpdate={handleForecastUpdate} />
              : <Navigate to="/upload" replace />
          } />

          <Route path="/models" element={
            <Models forecast={lastForecast} />
          } />

          <Route path="/insights" element={
            <Insights summary={summary} forecast={lastForecast} sessionId={sessionId} />
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
