/**
 * MemoryMeter — MEMORY 7,4 / 10,0 SEC ███████░░  (solo en Old School).
 */
import { Settings2 } from 'lucide-react'
import { useProject } from '../state/projectStore'
import { oldSchoolOf, memoryUsed } from '../engines/oldSchool'
import { goto } from '../actions/sampleActions'

const f1 = (n) => n.toFixed(1).replace('.', ',')

/** `used` permite mostrar la memoria con una selección aún sin confirmar (pantalla Cut). */
export default function MemoryMeter({ used: usedOverride, showLink = true }) {
  const project = useProject(p => p)
  const os = oldSchoolOf(project)
  if (!os.enabled) return null
  const used = usedOverride ?? memoryUsed(project)
  const pct = Math.min(100, (used / os.memorySec) * 100)
  const over = used > os.memorySec + 1e-6
  return (
    <div className={`memory${over ? ' is-over' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={os.memorySec} aria-valuenow={+used.toFixed(1)} aria-label="Memoria del sampler">
      <span className="memory-label">MEMORY</span>
      <span className="memory-val">{f1(used)} / {f1(os.memorySec)} s</span>
      <span className="memory-bar"><i style={{ width: `${pct}%` }} /></span>
      <span className="memory-spec">{os.bits} bits · {(os.sampleRate / 1000).toFixed(0)} kHz{os.mono ? ' · mono' : ''}</span>
      {showLink && <button className="btn btn-ghost btn-icon" onClick={() => goto('oldschool')} aria-label="Ajustes Old School"><Settings2 size={16} /></button>}
    </div>
  )
}
