import { useState, useCallback } from 'react'
import { api } from '../api/client'

export function useForecast(sessionId) {
  const [products, setProducts]   = useState([])
  const [forecast, setForecast]   = useState(null)
  const [history, setHistory]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)

  const loadProducts = useCallback(async () => {
    if (!sessionId) return
    try {
      const data = await api.getProducts(sessionId)
      setProducts(data.products)
    } catch (err) {
      setError(err.message)
    }
  }, [sessionId])

  const runForecast = async (store, item, horizon) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.forecast(sessionId, store, item, horizon)
      setForecast(data)
      await loadHistory()
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const loadHistory = async () => {
    if (!sessionId) return
    try {
      const data = await api.getResults(sessionId)
      setHistory(data.forecasts)
    } catch (_) {}
  }

  const selectFromHistory = async (forecastId) => {
    try {
      const data = await api.getResult(forecastId)
      setForecast(data)
    } catch (err) {
      setError(err.message)
    }
  }

  const removeFromHistory = async (forecastId) => {
    try {
      await api.deleteResult(forecastId)
      setHistory((prev) => prev.filter((f) => f.forecast_id !== forecastId))
      if (forecast?.forecast_id === forecastId) setForecast(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return {
    products, forecast, history, loading, error,
    loadProducts, runForecast, loadHistory,
    selectFromHistory, removeFromHistory,
  }
}
