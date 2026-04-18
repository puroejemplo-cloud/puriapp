'use client'
import { useEffect } from 'react'

// Registra el Service Worker para habilitar PWA instalable
export default function RegistrarSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}
