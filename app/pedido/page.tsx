// Esta ruta no tiene ID de purificadora. La URL correcta es /pedido/[id]
export default function PedidoSinId() {
  return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <h1 className="text-lg font-bold text-gray-800 mb-2">Enlace incompleto</h1>
        <p className="text-gray-500 text-sm">
          Pide a tu purificadora que te comparta el enlace correcto para hacer pedidos.
        </p>
      </div>
    </div>
  )
}
