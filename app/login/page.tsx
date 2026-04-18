'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { crearClienteBrowser } from '@/lib/supabase-browser'

export default function LoginPage() {
  const router = useRouter()
  const supabase = useMemo(() => crearClienteBrowser(), [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setError(error.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos'
          : `Error: ${error.message}`)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      const role = user?.user_metadata?.role
      if (role === 'super_admin') {
        router.push('/superadmin')
      } else if (role === 'admin') {
        router.push('/admin')
      } else {
        router.push('/repartidor')
      }
    } catch {
      setError('Sin conexión con el servidor.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-5xl mb-2">💧</p>
          <h1 className="text-2xl font-bold text-sky-600">Purificadora</h1>
          <p className="text-gray-400 text-sm mt-1">Acceso al sistema</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              placeholder="tu@correo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-sky-500 text-white py-3 rounded-xl font-semibold text-sm active:bg-sky-600 disabled:opacity-50"
          >
            {cargando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
