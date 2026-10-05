/**
 * MixPanel — mezcla sencilla: sample, batería y volumen general.
 */
import { SlidersHorizontal } from 'lucide-react'
import { useProject } from '../state/projectStore'
import { mixOf } from '../engines/projectModel'
import { setMix } from '../actions/mixActions'

const CHANNELS = [['chops', 'Sample'], ['drums', 'Batería'], ['master', 'General']]

export default function MixPanel() {
  const mix = useProject(p => p.settings?.mix)
  const m = mixOf({ settings: { mix } })
  return (
    <div className="mix" role="group" aria-label="Mezcla">
      <span className="insp-label"><SlidersHorizontal size={14} /> Mezcla</span>
      {CHANNELS.map(([id, label]) => (
        <label key={id} className="mix-ch">
          <span>{label}</span>
          <input type="range" min="0" max="1.5" step="0.05" value={m[id]}
            onChange={e => setMix(id, Number(e.target.value))} aria-label={`Volumen ${label}`} />
        </label>
      ))}
    </div>
  )
}
