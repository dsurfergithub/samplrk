import { useState } from 'react'
import { Play, Download, Trash2, Save, AlertTriangle, Link2 } from 'lucide-react'
import { useStore } from '../state/store'
import { useTransport } from './hooks'
import { toggleLoopPad, previewLoop, deleteLoop, exportLoopWav, saveScene } from '../app/actions'

export default function LoopsView() {
  const loops = useStore(s => s.loops)
  const t = useTransport()
  const [sceneName, setSceneName] = useState('')

  if (loops.length === 0) {
    return (
      <div className="empty">
        <b>Todavía no hay loops en la biblioteca.</b><br />
        Ve al Editor y pulsa «Generar loops» para que SAMPLRK proponga cortes alineados
        al compás, o selecciona un tramo de la onda y usa «Loop de selección».
      </div>
    )
  }

  return (
    <div>
      <div className="loops-head">
        <div>
          <div className="section-title">Launchpad</div>
          <div className="section-sub">
            Toca un pad para activarlo: entra siempre en el próximo compás, nunca fuera de sincronía.
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="Nombre de escena…" value={sceneName}
            onChange={e => setSceneName(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={() => { saveScene(sceneName); setSceneName('') }}
            disabled={t.activeLoopIds.length === 0}
            title={t.activeLoopIds.length === 0 ? 'Activa algún loop primero' : 'Guardar los loops activos como escena'}
          >
            <Save size={15} /> Guardar escena ({t.activeLoopIds.length})
          </button>
        </div>
      </div>

      <div className="pad-grid">
        {loops.map(loop => {
          const active = t.activeLoopIds.includes(loop.id)
          return (
            <button
              key={loop.id}
              className={`pad${active ? ' active' : ''}`}
              style={{ '--pad-color': loop.color }}
              onClick={() => toggleLoopPad(loop)}
              title={active ? 'Se detendrá en el próximo compás' : 'Entrará en el próximo compás'}
            >
              <span className="pad-state" />
              <div className="pad-name">{loop.name}</div>
              <div className="pad-meta">
                <span className="badge">{loop.bars}c · {loop.bpm} BPM</span>
                <span className="badge">{loop.key}{loop.mode === 'minor' ? 'm' : ''}</span>
                <span className="badge">{loop.mood}</span>
                {loop.compatibleWith.length > 0 && (
                  <span className="badge accent" title="Loops compatibles en tonalidad y tempo">
                    <Link2 size={10} /> {loop.compatibleWith.length}
                  </span>
                )}
                {!loop.valid && (
                  <span className="badge pink" title={loop.issues.join(' · ')}>
                    <AlertTriangle size={10} /> aviso
                  </span>
                )}
              </div>
              <div className="energy"><i style={{ width: `${Math.round(loop.energy * 100)}%` }} /></div>
              <div className="pad-actions">
                <span
                  className="mini" role="button" title="Preescuchar una vez"
                  onClick={ev => { ev.stopPropagation(); previewLoop(loop) }}
                >
                  <Play size={11} />
                </span>
                <span
                  className="mini" role="button" title="Exportar WAV"
                  onClick={ev => { ev.stopPropagation(); exportLoopWav(loop) }}
                >
                  <Download size={11} />
                </span>
                <span
                  className="mini" role="button" title="Eliminar de la biblioteca"
                  onClick={ev => { ev.stopPropagation(); deleteLoop(loop.id) }}
                >
                  <Trash2 size={11} />
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
