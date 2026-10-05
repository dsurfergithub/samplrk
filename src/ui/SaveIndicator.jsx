/**
 * SaveIndicator — «Guardado ✓», discreto. Nunca interrumpe.
 */
import { Check, CloudOff, Loader2 } from 'lucide-react'
import { useUi } from '../state/uiStore'

export default function SaveIndicator() {
  const save = useUi(s => s.save)
  if (save.status === 'idle') return null
  const map = {
    saving: [<Loader2 key="i" size={14} className="spin" />, 'Guardando…'],
    pending: [<Loader2 key="i" size={14} className="spin" />, 'Guardando…'],
    saved: [<Check key="i" size={14} />, 'Guardado'],
    error: [<CloudOff key="i" size={14} />, 'Sin guardar'],
    unavailable: [<CloudOff key="i" size={14} />, 'No se guarda'],
  }
  const [icon, text] = map[save.status] ?? map.saved
  const title = save.status === 'unavailable'
    ? (save.message ?? 'Este navegador no permite guardar (¿modo privado?). Exporta tu beat en WAV para no perderlo.')
    : save.status === 'error' ? save.message : 'Tu proyecto se guarda solo, en este navegador.'
  return (
    <span className={`save-ind is-${save.status}`} role="status" aria-live="polite" title={title}>
      {icon}<span className="save-text">{text}</span>
    </span>
  )
}
