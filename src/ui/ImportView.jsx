import { useRef, useState } from 'react'
import { Upload, Mic, FlaskConical, Play, Trash2, PencilRuler, Download } from 'lucide-react'
import { useStore, setState } from '../state/store'
import {
  importFiles, toggleRecording, createDemoSample, deleteSample,
  previewSampleSelection, exportSampleWav,
} from '../app/actions'

export default function ImportView() {
  const samples = useStore(s => s.samples)
  const recording = useStore(s => s.recording)
  const [over, setOver] = useState(false)
  const fileRef = useRef()

  return (
    <div>
      <div
        className={`dropzone${over ? ' over' : ''}`}
        onDragOver={e => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); importFiles(e.dataTransfer.files) }}
      >
        <h2>Convierte cualquier sonido en un loop profesional</h2>
        <p>Arrastra aquí un WAV, MP3, FLAC, OGG, M4A o un vídeo. También puedes grabar con el micrófono.</p>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => fileRef.current.click()}>
            <Upload size={16} /> Elegir archivo
          </button>
          <button className={`btn btn-rec${recording ? ' recording' : ''}`} onClick={toggleRecording}>
            <Mic size={16} /> {recording ? 'Detener grabación' : 'Grabar micrófono'}
          </button>
          <button className="btn" onClick={createDemoSample}>
            <FlaskConical size={16} /> Crear beat de prueba
          </button>
        </div>
        <input
          ref={fileRef} type="file" hidden multiple
          accept="audio/*,video/*,.wav,.mp3,.flac,.ogg,.m4a"
          onChange={e => { importFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      <div className="flow">
        <b>Archivo</b> <span className="arrow">→</span>
        <b>Sample editable</b> <span className="arrow">→</span>
        <b>Loop inteligente</b> <span className="arrow">→</span>
        <b>Capas</b> <span className="arrow">→</span>
        <b>Canción</b>
      </div>

      {samples.length > 0 && (
        <>
          <div className="section-title">Tus samples</div>
          <div className="section-sub">El archivo original nunca se modifica: todo lo que hagas es reversible.</div>
          <div className="sample-grid">
            {samples.map(s => (
              <div key={s.id} className="card sample-card">
                <div className="name">{s.name}</div>
                <div className="meta">
                  <span className="badge">{s.duration.toFixed(1)} s</span>
                  <span className="badge">{s.channels === 1 ? 'mono' : 'estéreo'}</span>
                  {s.analysis ? (
                    <>
                      <span className="badge accent">{s.analysis.bpm} BPM</span>
                      <span className="badge accent">{s.analysis.key} {s.analysis.mode === 'minor' ? 'm' : ''}</span>
                    </>
                  ) : (
                    <span className="badge">analizando…</span>
                  )}
                </div>
                <div className="row">
                  <button
                    className="btn btn-primary" style={{ flex: 1 }}
                    onClick={() => setState({ activeSampleId: s.id, view: 'editor' })}
                  >
                    <PencilRuler size={15} /> Editar
                  </button>
                  <button className="btn btn-icon" title="Escuchar" onClick={() => previewSampleSelection(s, null)}>
                    <Play size={15} />
                  </button>
                  <button className="btn btn-icon" title="Exportar WAV" onClick={() => exportSampleWav(s)}>
                    <Download size={15} />
                  </button>
                  <button className="btn btn-icon btn-danger" title="Eliminar" onClick={() => deleteSample(s.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
