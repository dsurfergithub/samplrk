import { useState } from 'react'
import { Play, Square, Plus, Trash2, ArrowLeft, ArrowRight, Download } from 'lucide-react'
import { useStore } from '../store'
import { addSection, removeSection, moveSection, exportSongWav } from '../actions'
import { playTimeline, stopTimeline, SECTION_PRESETS, totalBars, songDuration } from '../../engines/timelineEngine'
import { stopTransport } from '../../engines/audioEngine'

export default function TimelineView() {
  const timeline = useStore(s => s.timeline)
  const scenes = useStore(s => s.scenes)
  const loops = useStore(s => s.loops)
  const bpm = useStore(s => s.bpm)
  const [form, setForm] = useState({ name: 'Intro', sceneId: '', bars: 4 })

  const sceneOf = id => scenes.find(s => s.id === id)
  const bars = totalBars(timeline)

  return (
    <div>
      <div className="section-title">Timeline</div>
      <div className="section-sub">
        Ordena tus escenas como secciones (Intro → Verse → Drop…) y exporta la canción completa.
      </div>

      <div className="tl-strip">
        {timeline.length === 0 && (
          <div className="tl-empty">La canción está vacía. Añade secciones abajo usando tus escenas.</div>
        )}
        {timeline.map(sec => {
          const scene = sceneOf(sec.sceneId)
          return (
            <div
              key={sec.id} className="tl-block"
              style={{ background: scene?.color ?? '#555', flexGrow: sec.bars, flexBasis: sec.bars * 26 }}
            >
              {sec.name}
              <small>{scene?.name ?? '—'} · {sec.bars}c</small>
            </div>
          )
        })}
      </div>

      {timeline.map(sec => (
        <div key={sec.id} className="tl-row">
          <b style={{ minWidth: 64, fontSize: 13 }}>{sec.name}</b>
          <span className="badge">{sceneOf(sec.sceneId)?.name ?? 'escena eliminada'}</span>
          <span className="badge">{sec.bars} compases</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="btn btn-icon" onClick={() => moveSection(sec.id, -1)} title="Mover antes"><ArrowLeft size={14} /></button>
            <button className="btn btn-icon" onClick={() => moveSection(sec.id, 1)} title="Mover después"><ArrowRight size={14} /></button>
            <button className="btn btn-icon btn-danger" onClick={() => removeSection(sec.id)} title="Quitar"><Trash2 size={14} /></button>
          </span>
        </div>
      ))}

      <div className="tl-row" style={{ borderStyle: 'dashed' }}>
        <select value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}>
          {SECTION_PRESETS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={form.sceneId} onChange={e => setForm(f => ({ ...f, sceneId: e.target.value }))}>
          <option value="">— elige escena —</option>
          {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input
          type="number" min="1" max="64" value={form.bars}
          onChange={e => setForm(f => ({ ...f, bars: Math.max(1, Number(e.target.value) || 4) }))}
        />
        <button
          className="btn btn-primary"
          disabled={!form.sceneId}
          onClick={() => addSection(form.name, form.sceneId, form.bars)}
        >
          <Plus size={15} /> Añadir sección
        </button>
      </div>

      <div className="toolbar" style={{ marginTop: 18 }}>
        <button
          className="btn btn-primary" disabled={timeline.length === 0}
          onClick={() => playTimeline(timeline, scenes, loops)}
        >
          <Play size={15} /> Reproducir canción
        </button>
        <button className="btn" onClick={() => { stopTimeline(); stopTransport() }}>
          <Square size={15} /> Detener
        </button>
        <button className="btn" disabled={timeline.length === 0} onClick={exportSongWav}>
          <Download size={15} /> Exportar canción (WAV)
        </button>
        {timeline.length > 0 && (
          <span className="badge accent">
            {bars} compases · {songDuration(timeline, bpm).toFixed(1)} s a {Math.round(bpm)} BPM
          </span>
        )}
      </div>
    </div>
  )
}
