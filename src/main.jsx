/**
 * Punto de entrada. Router mínimo por hash:
 *   #/legacy → interfaz SAMPLRK v0.1 (se mantiene mientras se estabiliza la 2.0)
 *   resto    → SAMPLRK 2
 * Cada interfaz se carga en su propio chunk (y con su propio CSS).
 */
import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'

const isLegacy = (hash = location.hash) => hash.startsWith('#/legacy')
const legacy = isLegacy()
const Root = lazy(() => (legacy ? import('./legacy/LegacyApp') : import('./App')))

// cambiar entre interfaces recarga: así nunca conviven sus estilos ni su estado
window.addEventListener('hashchange', () => { if (isLegacy() !== legacy) location.reload() })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<div className="boot">SAMPLRK</div>}>
      <Root />
    </Suspense>
  </React.StrictMode>,
)
