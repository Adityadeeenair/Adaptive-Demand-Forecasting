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
  const [sessionId,  setSessionId]  = useState(null)
  const [summary,    setSummary]    = useState(null)
  const [lastForecast, setLastForecast] = useState(null)
  const [apiStatus,  setApiStatus]  = useState(null)

  useEffect(() => {
    api.health()
      .then(() => setApiStatus(true))
      .catch(() => setApiStatus(false))
  }, [])

  const handleSessionCreated = (id, sum) => {
    setSessionId(id)
    setSummary(sum)
  }

  const handleForecastUpdate = (fc) => setLastForecast(fc)

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
            <Insights summary={summary} forecast={lastForecast} />
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
