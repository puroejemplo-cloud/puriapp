'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

/* ─── Scroll-reveal hook ─────────────────────────────────────── */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { (e.target as HTMLElement).style.animationPlayState = 'running'; io.unobserve(e.target) } }),
      { threshold: 0.12 },
    )
    els.forEach(el => { (el as HTMLElement).style.animationPlayState = 'paused'; io.observe(el) })
    return () => io.disconnect()
  }, [])
}

/* ─── Animated counter ───────────────────────────────────────── */
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      let start = 0; const dur = 1400; const t0 = performance.now()
      const tick = (now: number) => {
        const p = Math.min((now - t0) / dur, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        el.textContent = Math.round(ease * to) + suffix
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [to, suffix])
  return <span ref={ref}>0{suffix}</span>
}

export default function LandingPage() {
  useReveal()

  return (
    <>
      <style>{`
        @keyframes aurora {
          0%,100% { background-position: 0% 50% }
          50%      { background-position: 100% 50% }
        }
        @keyframes float {
          0%,100% { transform: translateY(0px) }
          50%      { transform: translateY(-14px) }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(.95); box-shadow: 0 0 0 0 rgba(56,189,248,.5) }
          70%  { transform: scale(1);   box-shadow: 0 0 0 18px rgba(56,189,248,0) }
          100% { transform: scale(.95); box-shadow: 0 0 0 0 rgba(56,189,248,0) }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center }
          100% { background-position:  200% center }
        }
        @keyframes fade-up {
          from { opacity:0; transform:translateY(28px) }
          to   { opacity:1; transform:translateY(0) }
        }
        @keyframes fade-in {
          from { opacity:0 }
          to   { opacity:1 }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg) }
          to   { transform: rotate(360deg) }
        }
        @keyframes gradient-border {
          0%,100% { background-position: 0% 50% }
          50%     { background-position: 100% 50% }
        }

        .aurora-bg {
          background: linear-gradient(135deg, #0f172a, #1e3a5f, #0c4a6e, #0f2a1a, #1e3a5f, #0f172a);
          background-size: 400% 400%;
          animation: aurora 12s ease infinite;
        }
        .text-gradient {
          background: linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #34d399 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .btn-primary {
          background: linear-gradient(135deg, #0ea5e9, #38bdf8);
          animation: pulse-ring 2.5s ease-out infinite;
          transition: transform .2s, filter .2s;
        }
        .btn-primary:hover { transform: translateY(-2px) scale(1.02); filter: brightness(1.1); }

        .card-glow {
          transition: transform .3s, box-shadow .3s, border-color .3s;
        }
        .card-glow:hover {
          transform: translateY(-4px);
          box-shadow: 0 0 30px rgba(56,189,248,.15);
          border-color: rgba(56,189,248,.4) !important;
        }

        [data-reveal] {
          animation: fade-up .7s cubic-bezier(.22,1,.36,1) both;
        }

        .pricing-border {
          background: linear-gradient(135deg, #0ea5e9, #818cf8, #34d399, #0ea5e9);
          background-size: 300% 300%;
          animation: gradient-border 4s ease infinite;
          padding: 2px;
          border-radius: 24px;
        }

        .dot-grid {
          background-image: radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px);
          background-size: 28px 28px;
        }

        .float-icon { animation: float 5s ease-in-out infinite; }
        .float-icon:nth-child(2) { animation-delay: -.8s; }
        .float-icon:nth-child(3) { animation-delay: -1.6s; }

        .step-connector {
          position: absolute; top: 50%; right: -16px;
          width: 32px; height: 2px;
          background: linear-gradient(90deg, #38bdf8, transparent);
        }
      `}</style>

      <div className="min-h-screen text-white" style={{ background: '#0f172a', fontFamily: 'var(--font-geist, system-ui, sans-serif)' }}>

        {/* ── NAVBAR ──────────────────────────────────────── */}
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/6"
          style={{ background: 'rgba(15,23,42,.85)', backdropFilter: 'blur(16px)' }}>
          <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">💧</span>
              <span className="font-black text-white text-lg tracking-tight">AquaGestión</span>
            </div>
            <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
              <a href="#features" className="hover:text-white transition-colors">Funciones</a>
              <a href="#como-funciona" className="hover:text-white transition-colors">Cómo funciona</a>
              <a href="#precio" className="hover:text-white transition-colors">Precio</a>
            </nav>
            <div className="flex items-center gap-3">
              <a href="https://wa.me/52XXXXXXXXXX" className="hidden sm:flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
                <span>💬</span> Contactar
              </a>
              <Link href="/login"
                className="text-sm font-semibold px-5 py-2 rounded-xl border border-sky-500/50 text-sky-400 hover:bg-sky-500 hover:text-white hover:border-sky-500 transition-all">
                Iniciar sesión
              </Link>
            </div>
          </div>
        </header>

        {/* ── HERO ────────────────────────────────────────── */}
        <section className="aurora-bg dot-grid relative overflow-hidden pt-32 pb-28 px-5">
          {/* Orbs */}
          <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
            style={{ background: 'radial-gradient(circle, #38bdf8, transparent 70%)', animation: 'float 8s ease-in-out infinite' }} />
          <div className="absolute bottom-10 right-1/4 w-96 h-96 rounded-full opacity-15 blur-3xl pointer-events-none"
            style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)', animation: 'float 10s ease-in-out infinite reverse' }} />
          <div className="absolute top-1/2 left-10 w-48 h-48 rounded-full opacity-10 blur-2xl pointer-events-none"
            style={{ background: 'radial-gradient(circle, #34d399, transparent 70%)', animation: 'float 7s ease-in-out infinite 1s' }} />

          <div className="relative max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div data-reveal
              className="inline-flex items-center gap-2 border border-sky-500/30 rounded-full px-4 py-1.5 text-sky-300 text-sm font-medium mb-8"
              style={{ background: 'rgba(56,189,248,.08)', animationDelay: '0s' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Sistema listo para operar hoy
            </div>

            {/* Headline */}
            <h1 data-reveal style={{ animationDelay: '.1s' }}
              className="text-5xl sm:text-7xl font-black leading-[1.02] tracking-tight mb-6">
              Gestión inteligente<br />
              <span className="text-gradient">para tu purificadora</span>
            </h1>

            <p data-reveal style={{ animationDelay: '.2s' }}
              className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
              Pedidos por WhatsApp y web, rutas en tiempo real, rellenadora conectada
              y control total desde el celular.
            </p>

            {/* CTAs */}
            <div data-reveal style={{ animationDelay: '.3s' }} className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
              <a href="https://wa.me/52XXXXXXXXXX?text=Hola,%20quiero%20una%20demo%20de%20AquaGestión"
                className="btn-primary inline-flex items-center justify-center gap-2 text-white font-bold text-base px-8 py-4 rounded-2xl shadow-xl shadow-sky-900/50">
                💬 Quiero una demo gratis
              </a>
              <Link href="/login"
                className="inline-flex items-center justify-center gap-2 font-semibold text-base px-8 py-4 rounded-2xl transition-all hover:bg-white/10 border border-white/15 text-slate-300">
                Ya soy cliente →
              </Link>
            </div>

            {/* Stats */}
            <div data-reveal style={{ animationDelay: '.4s' }}
              className="grid grid-cols-3 gap-4 max-w-md mx-auto">
              {[
                { num: 0,   suffix: '',    label: 'Pedidos perdidos' },
                { num: 30,  suffix: '%+',  label: 'Más entregas' },
                { num: 5,   suffix: 'min', label: 'Para arrancar' },
              ].map(s => (
                <div key={s.label}
                  className="rounded-2xl py-5 px-3 border border-white/8"
                  style={{ background: 'rgba(255,255,255,.04)' }}>
                  <p className="text-3xl font-black text-sky-400">
                    <Counter to={s.num} suffix={s.suffix} />
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── LOGOS / PRUEBA SOCIAL ────────────────────────── */}
        <div className="border-y border-white/6 py-5 px-5" style={{ background: 'rgba(255,255,255,.02)' }}>
          <p className="text-center text-xs text-slate-600 uppercase tracking-widest mb-4">Funciona sobre infraestructura de nivel mundial</p>
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {['Supabase', 'Vercel', 'Twilio', 'WhatsApp API', 'Google Maps'].map(t => (
              <span key={t} className="text-slate-600 text-sm font-medium">{t}</span>
            ))}
          </div>
        </div>

        {/* ── FEATURES ────────────────────────────────────── */}
        <section id="features" className="py-24 px-5 dot-grid" style={{ background: '#0f172a' }}>
          <div className="max-w-6xl mx-auto">
            <p data-reveal className="text-emerald-400 text-sm font-bold uppercase tracking-widest text-center mb-3">Todo incluido</p>
            <h2 data-reveal style={{ animationDelay: '.1s' }}
              className="text-3xl sm:text-5xl font-black text-center mb-3">
              Un sistema completo,<br />nada por separado
            </h2>
            <p data-reveal style={{ animationDelay: '.2s' }}
              className="text-slate-400 text-center text-lg mb-14">Hecho específicamente para purificadoras de agua mexicanas</p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { icon: '💬', color: '#25d366', bg: 'rgba(37,211,102,.08)', border: 'rgba(37,211,102,.2)',  title: 'Pedidos por WhatsApp',   desc: 'El cliente manda un mensaje y el pedido aparece automáticamente. Sin operadores, sin errores.' },
                { icon: '🌐', color: '#38bdf8', bg: 'rgba(56,189,248,.08)', border: 'rgba(56,189,248,.2)',  title: 'Link de pedidos web',     desc: 'URL personalizada para tu purificadora. El cliente pide en menos de 30 segundos desde su celular.' },
                { icon: '📱', color: '#818cf8', bg: 'rgba(129,140,248,.08)',border: 'rgba(129,140,248,.2)', title: 'App del repartidor',      desc: 'PWA que funciona como app nativa. Pedidos ordenados por distancia y navegación con un toque.' },
                { icon: '🏭', color: '#f59e0b', bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.2)',  title: 'Control de rellenadora',  desc: 'Turnos, stock y entregas a repartidores registradas en tiempo real. Nunca más perder un garrafón.' },
                { icon: '🔔', color: '#f43f5e', bg: 'rgba(244,63,94,.08)',  border: 'rgba(244,63,94,.2)',   title: 'Notificaciones push',     desc: 'Cada pedido nuevo llega al repartidor al instante en su celular, sin necesidad de abrir la app.' },
                { icon: '📊', color: '#34d399', bg: 'rgba(52,211,153,.08)', border: 'rgba(52,211,153,.2)',  title: 'Panel + Mapa en vivo',    desc: 'Ve todos los pedidos sobre el mapa, reportes de ventas y gestión de usuarios desde cualquier dispositivo.' },
              ].map((f, i) => (
                <div key={f.title} data-reveal
                  className="card-glow rounded-2xl p-6 border"
                  style={{ background: f.bg, borderColor: f.border, animationDelay: `${i * .08}s` }}>
                  <div className="text-4xl mb-4 float-icon">{f.icon}</div>
                  <h3 className="font-bold text-base mb-2" style={{ color: f.color }}>{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CÓMO FUNCIONA ───────────────────────────────── */}
        <section id="como-funciona" className="py-24 px-5"
          style={{ background: 'linear-gradient(180deg, #0f172a 0%, #0c1a2e 100%)' }}>
          <div className="max-w-6xl mx-auto">
            <p data-reveal className="text-sky-400 text-sm font-bold uppercase tracking-widest text-center mb-3">Flujo de pedido</p>
            <h2 data-reveal style={{ animationDelay: '.1s' }}
              className="text-3xl sm:text-5xl font-black text-center mb-3">El cliente pide,<br />tú solo entregas</h2>
            <p data-reveal style={{ animationDelay: '.2s' }} className="text-slate-400 text-center text-lg mb-16">
              Sin llamadas. Sin anotaciones. Sin caos.
            </p>

            <div className="grid sm:grid-cols-5 gap-4">
              {[
                { num: '1', icon: '🔗', text: 'Compartes tu link personalizado por WhatsApp o redes sociales' },
                { num: '2', icon: '📝', text: 'Cliente llena el formulario en su celular en menos de 30 seg' },
                { num: '3', icon: '🔔', text: 'Pedido creado al instante y notificación push al repartidor' },
                { num: '4', icon: '🗺️', text: 'Repartidor navega con GPS directo al domicilio del cliente' },
                { num: '5', icon: '✅', text: 'Cliente rastrea la entrega en tiempo real desde el mismo link' },
              ].map((s, i) => (
                <div key={s.num} data-reveal style={{ animationDelay: `${i * .1}s` }} className="relative">
                  <div className="rounded-2xl p-5 text-center h-full border border-sky-900/40 hover:border-sky-500/40 transition-colors"
                    style={{ background: 'rgba(56,189,248,.05)' }}>
                    <div className="w-10 h-10 rounded-full bg-sky-500 text-white font-black text-sm flex items-center justify-center mx-auto mb-3 shadow-lg shadow-sky-900/50">
                      {s.num}
                    </div>
                    <div className="text-2xl mb-2">{s.icon}</div>
                    <p className="text-sm text-slate-400 leading-relaxed">{s.text}</p>
                  </div>
                  {i < 4 && <div className="hidden sm:block step-connector" />}
                </div>
              ))}
            </div>

            {/* Mini métricas */}
            <div data-reveal className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-14">
              {[
                { val: 24, suf: '/7',  label: 'Recibe pedidos',     color: '#38bdf8' },
                { val: 0,  suf: ' llamadas', label: 'Necesarias',   color: '#34d399' },
                { val: 30, suf: 'seg', label: 'Para hacer un pedido', color: '#818cf8' },
                { val: 100,suf: '%',   label: 'En tiempo real',     color: '#f59e0b' },
              ].map(m => (
                <div key={m.label} className="rounded-2xl p-5 text-center border border-white/6"
                  style={{ background: 'rgba(255,255,255,.03)' }}>
                  <p className="text-3xl font-black" style={{ color: m.color }}>
                    <Counter to={m.val} suffix={m.suf} />
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRECIO ──────────────────────────────────────── */}
        <section id="precio" className="py-24 px-5 dot-grid"
          style={{ background: 'linear-gradient(180deg, #0c1a2e 0%, #0f172a 100%)' }}>
          <div className="max-w-6xl mx-auto text-center">
            <p data-reveal className="text-sky-400 text-sm font-bold uppercase tracking-widest mb-3">Inversión</p>
            <h2 data-reveal style={{ animationDelay: '.1s' }}
              className="text-3xl sm:text-5xl font-black mb-3">Precio para empezar hoy</h2>
            <p data-reveal style={{ animationDelay: '.2s' }}
              className="text-slate-400 text-lg mb-14">Sin contratos largos. Sin permanencia forzosa. Sin sorpresas.</p>

            <div data-reveal style={{ animationDelay: '.3s' }} className="max-w-sm mx-auto">
              {/* Animated gradient border */}
              <div className="pricing-border">
                <div className="rounded-[22px] p-8" style={{ background: '#0f1e33' }}>

                  {/* Badge */}
                  <div className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500/20 to-indigo-500/20 border border-sky-500/30 rounded-full px-4 py-1.5 text-sky-300 text-xs font-bold uppercase tracking-wider mb-6">
                    🎉 Promo inicio de actividades
                  </div>

                  {/* Pago inicial */}
                  <div className="rounded-2xl p-4 mb-4 border border-white/8" style={{ background: 'rgba(255,255,255,.04)' }}>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Pago inicial único</p>
                    <div className="flex items-end justify-center gap-1">
                      <span className="text-slate-400 text-lg font-bold mb-1">$</span>
                      <span className="text-5xl font-black text-white">800</span>
                      <span className="text-slate-500 text-sm mb-2 ml-1">MXN</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Configuración e instalación incluida</p>
                  </div>

                  {/* Mensualidad */}
                  <div className="rounded-2xl p-4 mb-6 border border-sky-500/30"
                    style={{ background: 'linear-gradient(135deg, rgba(14,165,233,.12), rgba(129,140,248,.08))' }}>
                    <p className="text-xs text-sky-400 uppercase tracking-wider mb-2">Renta mensual</p>
                    <div className="flex items-end justify-center gap-1">
                      <span className="text-sky-400 text-lg font-bold mb-1">$</span>
                      <span className="text-5xl font-black text-white">500</span>
                      <span className="text-slate-400 text-sm mb-2 ml-1">/mes</span>
                    </div>
                    <p className="text-xs text-sky-300 mt-1">Precio especial por inicio de actividades</p>
                  </div>

                  {/* Lista */}
                  <ul className="space-y-2.5 text-left mb-7">
                    {[
                      ['💬', 'WhatsApp automatizado'],
                      ['🌐', 'Link de pedidos web personalizado'],
                      ['📱', 'App del repartidor (ilimitados)'],
                      ['🏭', 'App de rellenadora'],
                      ['📊', 'Panel admin + mapa en vivo'],
                      ['📈', 'Reportes y contabilidad'],
                      ['🛟', 'Soporte por WhatsApp incluido'],
                    ].map(([icon, text]) => (
                      <li key={text} className="flex items-center gap-2.5 text-sm text-slate-300">
                        <span className="text-base">{icon}</span> {text}
                      </li>
                    ))}
                  </ul>

                  <a href="https://wa.me/52XXXXXXXXXX?text=Hola,%20quiero%20contratar%20AquaGestión"
                    className="block w-full text-center font-bold py-4 rounded-2xl text-white transition-all hover:-translate-y-0.5"
                    style={{
                      background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                      boxShadow: '0 8px 32px rgba(14,165,233,.35)',
                    }}>
                    Contratar ahora →
                  </a>
                  <p className="text-xs text-slate-600 mt-3">* Precios en MXN. Sin permanencia forzosa.</p>
                </div>
              </div>
            </div>

            {/* Garantías */}
            <div data-reveal className="flex flex-wrap gap-6 justify-center mt-10 text-sm text-slate-500">
              {['✓ Configuración el mismo día', '✓ Sin permanencia', '✓ $0 hardware extra', '✓ Soporte incluido'].map(g => (
                <span key={g}>{g}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ───────────────────────────────────── */}
        <section className="py-24 px-5 text-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0c2a3f 0%, #0f172a 50%, #071a10 100%)' }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(56,189,248,.07), transparent)' }} />
          <div className="relative max-w-3xl mx-auto">
            <h2 data-reveal className="text-4xl sm:text-6xl font-black mb-5 leading-tight">
              ¿Listo para modernizar<br />
              <span className="text-gradient">tu purificadora?</span>
            </h2>
            <p data-reveal style={{ animationDelay: '.1s' }}
              className="text-slate-400 text-xl mb-10">
              Arrancamos esta semana. La configuración es el mismo día que contratas.
            </p>
            <div data-reveal style={{ animationDelay: '.2s' }}
              className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="https://wa.me/52XXXXXXXXXX?text=Hola,%20quiero%20una%20demo%20de%20AquaGestión"
                className="btn-primary inline-flex items-center justify-center gap-2 text-white font-bold px-10 py-4 rounded-2xl shadow-xl shadow-sky-900/50 text-lg">
                💬 Hablar por WhatsApp
              </a>
              <Link href="/login"
                className="inline-flex items-center justify-center gap-2 font-semibold px-10 py-4 rounded-2xl transition-all hover:bg-white/10 border border-white/15 text-slate-300 text-lg">
                Iniciar sesión
              </Link>
            </div>
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────── */}
        <footer className="border-t border-white/6 py-8 px-5" style={{ background: '#0a1020' }}>
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span className="text-xl">💧</span>
              <span className="font-bold text-slate-400">AquaGestión</span>
              <span>— Sistema de gestión para purificadoras</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="https://wa.me/52XXXXXXXXXX" className="hover:text-white transition-colors">Contacto</a>
              <Link href="/login" className="hover:text-white transition-colors">Iniciar sesión</Link>
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}
