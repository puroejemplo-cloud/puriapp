import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans">

      {/* ── NAVBAR ───────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[#0f172a]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">💧</span>
            <span className="font-bold text-white text-lg tracking-tight">AquaGestión</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/52XXXXXXXXXX"
              className="hidden sm:flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <span>📞</span> Contactar
            </a>
            <Link
              href="/login"
              className="bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #0c4a6e 100%)' }}
      >
        {/* Glow decorativo */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #38bdf8 0%, transparent 70%)' }}
        />

        <div className="relative max-w-6xl mx-auto px-5 py-24 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 bg-sky-500/15 border border-sky-500/30 rounded-full px-4 py-1.5 text-sky-300 text-sm font-medium mb-8">
            🚀 Sistema listo para operar hoy
          </div>

          <h1 className="text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight mb-6">
            Gestión inteligente<br />
            <span className="text-sky-400">para tu purificadora</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Pedidos por WhatsApp y web, rutas en tiempo real, rellenadora conectada
            y control total desde el celular — sin instalar nada.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://wa.me/52XXXXXXXXXX?text=Hola,%20quiero%20info%20sobre%20AquaGestión"
              className="inline-flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all hover:-translate-y-0.5 shadow-lg shadow-sky-900/40"
            >
              💬 Quiero una demo gratis
            </a>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/12 border border-white/15 text-white font-semibold text-base px-8 py-4 rounded-2xl transition-colors"
            >
              Iniciar sesión →
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-4 max-w-lg mx-auto">
            {[
              { num: '0',    label: 'Pedidos perdidos' },
              { num: '+30%', label: 'Más entregas' },
              { num: '5min', label: 'Para arrancar' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl py-4 px-2">
                <p className="text-2xl font-black text-sky-400">{s.num}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEMAS ────────────────────────────────────── */}
      <section className="py-20 px-5" style={{ background: '#0f172a' }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-sky-400 text-sm font-bold uppercase tracking-widest text-center mb-3">El problema</p>
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-12">¿Te suena familiar?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '📞', title: 'Pedidos perdidos',       desc: 'Llamadas sin contestar y mensajes olvidados que se van con la competencia.' },
              { icon: '🗺️', title: 'Repartidores sin guía', desc: 'No saben a quién entregar primero y regresan con garrafones.' },
              { icon: '📋', title: 'Inventario a ciegas',   desc: 'No sabes cuántos garrafones salieron ni dónde están los prestados.' },
              { icon: '💸', title: 'Sin control de dinero', desc: 'Fin del día y no sabes cuánto entró ni qué clientes deben.' },
            ].map(p => (
              <div key={p.title} className="bg-red-950/30 border border-red-900/40 rounded-2xl p-6">
                <div className="text-3xl mb-3">{p.icon}</div>
                <h3 className="font-bold text-red-300 mb-2">{p.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOLUCIÓN ─────────────────────────────────────── */}
      <section className="py-20 px-5" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #0f2318 100%)' }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest text-center mb-3">La solución</p>
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-3">Todo conectado, en tiempo real</h2>
          <p className="text-slate-400 text-center mb-12">Hecho específicamente para purificadoras de agua</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: '💬', title: 'Pedidos por WhatsApp',   desc: 'El cliente manda un mensaje y el pedido aparece automáticamente, sin operadores.' },
              { icon: '🌐', title: 'Pedidos por web',        desc: 'Link propio para cada purificadora. El cliente pide en 30 segundos desde su celular.' },
              { icon: '📱', title: 'App del repartidor',     desc: 'PWA que funciona como app nativa. Pedidos ordenados por distancia, GPS integrado.' },
              { icon: '🏭', title: 'Control de rellenadora', desc: 'Turnos, stock y entregas a repartidores registrados en tiempo real.' },
              { icon: '🔔', title: 'Notificaciones push',    desc: 'Cada pedido nuevo llega al repartidor al instante, sin estar en la app.' },
              { icon: '📊', title: 'Panel completo',         desc: 'Mapa en vivo, ventas, reportes y gestión de usuarios desde cualquier dispositivo.' },
            ].map(f => (
              <div key={f.title} className="bg-emerald-950/30 border border-emerald-900/30 rounded-2xl p-6 hover:border-emerald-700/50 transition-colors">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-emerald-300 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ────────────────────────────────── */}
      <section className="py-20 px-5" style={{ background: '#0f172a' }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-sky-400 text-sm font-bold uppercase tracking-widest text-center mb-3">Así funciona</p>
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-3">El cliente pide, tú entregas</h2>
          <p className="text-slate-400 text-center mb-12">Sin llamadas, sin anotaciones, sin caos</p>

          <div className="grid sm:grid-cols-5 gap-3">
            {[
              { num: '1', text: 'Compartes tu link de pedidos por WhatsApp o redes sociales' },
              { num: '2', text: 'Cliente llena el formulario en su celular en menos de 30 segundos' },
              { num: '3', text: 'Pedido creado al instante — notificación push al repartidor' },
              { num: '4', text: 'Repartidor navega con GPS directo al domicilio' },
              { num: '5', text: 'Cliente rastrea su entrega en tiempo real desde el mismo link' },
            ].map((s, i) => (
              <div key={s.num} className="relative">
                <div className="bg-sky-950/40 border border-sky-900/40 rounded-2xl p-5 text-center h-full">
                  <div className="w-9 h-9 rounded-full bg-sky-500 text-white font-black text-sm flex items-center justify-center mx-auto mb-3">
                    {s.num}
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{s.text}</p>
                </div>
                {i < 4 && (
                  <div className="hidden sm:block absolute top-1/2 -right-2 -translate-y-1/2 text-sky-700 font-bold z-10">›</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRECIO ───────────────────────────────────────── */}
      <section
        id="precio"
        className="py-20 px-5"
        style={{ background: 'linear-gradient(180deg, #0f172a 0%, #0c2233 100%)' }}
      >
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-sky-400 text-sm font-bold uppercase tracking-widest mb-3">Inversión</p>
          <h2 className="text-3xl sm:text-4xl font-black mb-3">Precio justo para empezar hoy</h2>
          <p className="text-slate-400 mb-12">Sin contratos largos. Sin permanencia forzosa.</p>

          <div className="max-w-sm mx-auto">
            <div className="relative bg-sky-950/50 border-2 border-sky-500/50 rounded-3xl p-8 shadow-2xl shadow-sky-950/60">
              {/* Badge promo */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-sky-500 to-cyan-400 text-white text-xs font-black uppercase tracking-wider px-5 py-2 rounded-full shadow-lg">
                  🎉 Promo inicio de actividades
                </span>
              </div>

              <div className="mt-4">
                {/* Pago inicial */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Pago inicial único</p>
                  <p className="text-4xl font-black text-white">$800</p>
                  <p className="text-sm text-slate-400 mt-1">Configuración e instalación incluida</p>
                </div>

                {/* Mensualidad */}
                <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl p-4 mb-6">
                  <p className="text-xs text-sky-400 uppercase tracking-wider mb-1">Renta mensual</p>
                  <div className="flex items-end gap-2 justify-center">
                    <p className="text-4xl font-black text-white">$500</p>
                    <p className="text-slate-400 text-sm mb-1">/mes</p>
                  </div>
                  <p className="text-xs text-sky-300 mt-1">Precio especial por inicio de actividades</p>
                </div>

                {/* Incluye */}
                <ul className="space-y-2 text-left mb-7">
                  {[
                    'WhatsApp automatizado',
                    'Link de pedidos web personalizado',
                    'App del repartidor (ilimitados)',
                    'App de rellenadora',
                    'Panel de administración completo',
                    'Mapa en vivo + reportes',
                    'Soporte por WhatsApp incluido',
                  ].map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm text-slate-300">
                      <span className="text-sky-400 font-bold shrink-0">✓</span> {item}
                    </li>
                  ))}
                </ul>

                <a
                  href="https://wa.me/52XXXXXXXXXX?text=Hola,%20quiero%20contratar%20AquaGestión"
                  className="block w-full bg-sky-500 hover:bg-sky-400 text-white font-bold py-4 rounded-2xl text-center transition-all hover:-translate-y-0.5 shadow-lg shadow-sky-900/50"
                >
                  Contratar ahora →
                </a>
                <p className="text-xs text-slate-500 mt-3">* Precios en MXN. Sin permanencia forzosa.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────── */}
      <section
        className="py-20 px-5 text-center"
        style={{ background: 'linear-gradient(135deg, #0c2a3f 0%, #0f172a 50%, #0a1f0a 100%)' }}
      >
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            ¿Listo para modernizar<br />
            <span className="text-sky-400">tu purificadora?</span>
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            Arrancamos esta semana. La configuración es el mismo día que contratas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://wa.me/52XXXXXXXXXX?text=Hola,%20quiero%20una%20demo%20de%20AquaGestión"
              className="inline-flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-bold px-8 py-4 rounded-2xl transition-all hover:-translate-y-0.5"
            >
              💬 Hablar por WhatsApp
            </a>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/12 border border-white/15 text-white font-semibold px-8 py-4 rounded-2xl transition-colors"
            >
              Iniciar sesión
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-6 justify-center text-sm text-slate-500">
            <span>✓ Configuración el mismo día</span>
            <span>✓ Sin permanencia</span>
            <span>✓ $0 hardware extra</span>
            <span>✓ Soporte incluido</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="border-t border-white/8 py-8 px-5" style={{ background: '#0f172a' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <span className="text-xl">💧</span>
            <span className="font-bold text-slate-400">AquaGestión</span>
            <span>— Sistema de gestión para purificadoras</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://wa.me/52XXXXXXXXXX" className="hover:text-white transition-colors">
              Contacto
            </a>
            <Link href="/login" className="hover:text-white transition-colors">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
