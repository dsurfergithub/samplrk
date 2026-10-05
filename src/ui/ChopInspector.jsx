/**
 * ChopInspector — el chop seleccionado: nombre, pitch, reverse, volumen y pad.
 * El pitch enseña la regla old school: más grave = más largo, más agudo = más corto.
 */
import { Minus, Plus, FlipHorizontal2, Play, RotateCcw, ArrowLeft, ArrowRight } from 'lucide-react'
import { PITCH_MIN, PITCH_MAX, pitchedDuration, formatSemitones } from '../engines/pitch'
import { sliceDuration } from '../engines/sliceModel'
import {
  setSlicePitch, toggleReverse, setSliceGain, renameSlice, resetSlice, movePad, hitSlice,
} from '../actions/samplerActions'

const fmtSec = (s) => `${s.toFixed(2).replace('.', ',')} s`

export default function ChopInspector({ slice, letter }) {
  const orig = sliceDuration(slice)
  const now = pitchedDuration(orig, slice.pitch)
  const max = Math.max(orig, now)

  return (
    <aside className="inspector" style={{ '--chop': slice.color }} aria-label={`Chop ${letter}`}>
      <div className="insp-head">
        <span className="insp-letter">{letter}</span>
        <input
          className="insp-name" value={slice.name} placeholder={`Chop ${letter}`} maxLength={24}
          onChange={e => renameSlice(slice.id, e.target.value)} aria-label="Nombre del chop"
        />
        <button className="btn btn-icon" onClick={() => hitSlice(slice.id)} aria-label="Escuchar chop"><Play size={16} /></button>
      </div>

      <div className="insp-section">Flip <span>· transforma el chop</span></div>
      <div className="insp-block">
        <div className="insp-label">Pitch <span>· velocidad</span></div>
        <div className="pitch-row">
          <button className="btn btn-icon" onClick={() => { setSlicePitch(slice.id, slice.pitch - 1); setTimeout(() => hitSlice(slice.id), 0) }} disabled={slice.pitch <= PITCH_MIN} aria-label="Bajar un semitono"><Minus size={16} /></button>
          <input type="range" min={PITCH_MIN} max={PITCH_MAX} step="1" value={slice.pitch}
            onChange={e => setSlicePitch(slice.id, Number(e.target.value))}
            onPointerUp={() => hitSlice(slice.id)}
            aria-label="Pitch en semitonos" aria-valuetext={`${formatSemitones(slice.pitch)} semitonos`} />
          <button className="btn btn-icon" onClick={() => { setSlicePitch(slice.id, slice.pitch + 1); setTimeout(() => hitSlice(slice.id), 0) }} disabled={slice.pitch >= PITCH_MAX} aria-label="Subir un semitono"><Plus size={16} /></button>
          <output className="pitch-val">{formatSemitones(slice.pitch)}</output>
        </div>
        <div className="dur-bars" aria-label={`Duración original ${fmtSec(orig)}, ahora ${fmtSec(now)}`}>
          <div className="dur-row"><span>Original</span><i style={{ width: `${(orig / max) * 100}%` }} /><b>{fmtSec(orig)}</b></div>
          <div className="dur-row is-now"><span>Ahora</span><i style={{ width: `${(now / max) * 100}%` }} /><b>{fmtSec(now)}</b></div>
        </div>
      </div>

      <div className="insp-block insp-split">
        <button className={`btn${slice.reversed ? ' is-on' : ''}`} onClick={() => { toggleReverse(slice.id); setTimeout(() => hitSlice(slice.id), 0) }} aria-pressed={slice.reversed}>
          <FlipHorizontal2 size={16} /> Reverse
        </button>
        <label className="gain">
          <span className="insp-label">Volumen</span>
          <input type="range" min="0" max="2" step="0.05" value={slice.gain}
            onChange={e => setSliceGain(slice.id, Number(e.target.value))} aria-label="Volumen del chop" />
        </label>
      </div>

      <div className="insp-block row">
        <span className="insp-label">Pad</span>
        <button className="btn btn-icon" onClick={() => movePad(slice.id, -1)} aria-label="Mover a pad anterior"><ArrowLeft size={16} /></button>
        <button className="btn btn-icon" onClick={() => movePad(slice.id, 1)} aria-label="Mover a pad siguiente"><ArrowRight size={16} /></button>
        <span className="spacer" />
        <button className="btn btn-ghost" onClick={() => resetSlice(slice.id)}><RotateCcw size={16} /> Restablecer</button>
      </div>
    </aside>
  )
}
