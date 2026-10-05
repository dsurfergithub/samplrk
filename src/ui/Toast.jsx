import { useUi } from '../state/uiStore'

/** Avisos breves y estado "ocupado". Los errores siempre en lenguaje humano. */
export default function Toast() {
  const toast = useUi(s => s.toast)
  const busy = useUi(s => s.busy)
  return (
    <>
      {busy && (
        <div className="busy" role="status" aria-live="polite">
          <div className="busy-card"><span className="busy-dots"><i /><i /><i /></span>{busy}</div>
        </div>
      )}
      {toast && <div className={`toast${toast.tone === 'error' ? ' is-error' : ''}`} role="alert">{toast.text}</div>}
    </>
  )
}
