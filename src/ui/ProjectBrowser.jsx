/**
 * ProjectBrowser — «Mis proyectos»: continuar, renombrar o borrar.
 * Todo vive en este navegador (sin cuentas ni nube).
 */
import { useState } from 'react'
import { Play, Pencil, Trash2, Check, X } from 'lucide-react'
import { useUi } from '../state/uiStore'
import { openProject, renameProject, deleteProject } from '../actions/projectActions'
import { startAudio } from '../actions/sampleActions'
import { relativeTime } from '../engines/persistModel'

function describe(s) {
  if (!s) return ''
  const parts = [s.sampleName]
  if (s.chops) parts.push(`${s.chops} chops`)
  if (s.hasPattern) parts.push('pattern')
  if (s.hasDrums) parts.push('batería')
  return parts.filter(Boolean).join(' · ')
}

async function open(id) {
  await startAudio()
  await openProject(id)
}

function Row({ p }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(p.name)
  const [confirm, setConfirm] = useState(false)
  return (
    <li className="proj">
      {editing ? (
        <form className="proj-edit" onSubmit={e => { e.preventDefault(); renameProject(p.id, name); setEditing(false) }}>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={60} autoFocus aria-label="Nombre del proyecto" />
          <button className="btn btn-icon" type="submit" aria-label="Guardar nombre"><Check size={16} /></button>
          <button className="btn btn-ghost btn-icon" type="button" onClick={() => { setName(p.name); setEditing(false) }} aria-label="Cancelar"><X size={16} /></button>
        </form>
      ) : (
        <button className="proj-main" onClick={() => open(p.id)}>
          <b>{p.name}</b>
          <span>{describe(p.summary)}{p.updatedAt ? ` · ${relativeTime(p.updatedAt)}` : ''}</span>
        </button>
      )}
      {!editing && (
        <div className="proj-actions">
          {confirm ? (
            <>
              <span className="proj-confirm">¿Borrar?</span>
              <button className="btn btn-danger" onClick={() => deleteProject(p.id)}>Sí</button>
              <button className="btn btn-ghost" onClick={() => setConfirm(false)}>No</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-icon" onClick={() => open(p.id)} aria-label={`Abrir ${p.name}`}><Play size={16} /></button>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditing(true)} aria-label={`Renombrar ${p.name}`}><Pencil size={16} /></button>
              <button className="btn btn-ghost btn-icon" onClick={() => setConfirm(true)} aria-label={`Borrar ${p.name}`}><Trash2 size={16} /></button>
            </>
          )}
        </div>
      )}
    </li>
  )
}

export default function ProjectBrowser() {
  const projects = useUi(s => s.projects)
  if (!projects.length) return null
  return (
    <section className="projects" aria-label="Mis proyectos">
      <h2 className="projects-title">Mis proyectos <span>· se guardan solos en este navegador</span></h2>
      <ul>{projects.map(p => <Row key={p.id} p={p} />)}</ul>
    </section>
  )
}
