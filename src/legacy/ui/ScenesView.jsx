import { Play, RefreshCw, Trash2, Download } from 'lucide-react'
import { useStore } from '../store'
import { launchScene, updateSceneFromLive, deleteScene, exportSceneWav } from '../actions'

export default function ScenesView() {
  const scenes = useStore(s => s.scenes)
  const loops = useStore(s => s.loops)

  if (scenes.length === 0) {
    return (
      <div className="empty">
        <b>Aún no has guardado escenas.</b><br />
        Una escena recuerda qué loops suenan juntos (y su volumen y pan). Activa una combinación
        que te guste en el Launchpad y pulsa «Guardar escena».
      </div>
    )
  }

  return (
    <div>
      <div className="section-title">Escenas</div>
      <div className="section-sub">
        Lanzar una escena cambia todos los loops a la vez, siempre en el próximo compás.
      </div>
      <div className="scene-grid">
        {scenes.map(scene => (
          <div key={scene.id} className="card scene-card">
            <div className="head">
              <span className="dot" style={{ background: scene.color }} />
              <b>{scene.name}</b>
              <span className="badge" style={{ marginLeft: 'auto' }}>
                {Object.keys(scene.loops).length} loops
              </span>
            </div>
            <div className="chips">
              {Object.keys(scene.loops).map(id => {
                const loop = loops.find(l => l.id === id)
                return loop
                  ? <span key={id} className="badge" style={{ color: loop.color, borderColor: loop.color + '55' }}>{loop.name}</span>
                  : null
              })}
            </div>
            <div className="row">
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => launchScene(scene.id)}>
                <Play size={15} /> Lanzar
              </button>
              <button className="btn btn-icon" title="Actualizar con los loops activos" onClick={() => updateSceneFromLive(scene.id)}>
                <RefreshCw size={15} />
              </button>
              <button className="btn btn-icon" title="Exportar 4 compases a WAV" onClick={() => exportSceneWav(scene.id, 4)}>
                <Download size={15} />
              </button>
              <button className="btn btn-icon btn-danger" title="Eliminar" onClick={() => deleteScene(scene.id)}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
