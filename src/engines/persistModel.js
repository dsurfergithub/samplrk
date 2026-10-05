/**
 * persistModel.js — qué se guarda y cómo se resume (puro).
 */
import { serializeProject } from './projectModel'

/** Un proyecto merece guardarse cuando ya tiene audio. */
export const isWorthSaving = (project) => project.samples.length > 0

/** Samples cuyo audio hay que guardar como archivo (los discos de práctica se regeneran). */
export const samplesNeedingBlob = (project) => project.samples.filter(s => s.origin?.kind === 'file')

/** Resumen para la lista «Mis proyectos» (sin abrir el proyecto). */
export function projectSummary(project) {
  const sample = project.samples.find(s => s.id === project.activeSampleId) ?? project.samples[0]
  const slices = project.slices.filter(s => s.sampleId === sample?.id).length
  const chops = project.patterns.find(p => (p.kind ?? 'chops') === 'chops')
  const drums = project.patterns.find(p => p.kind === 'drums')
  return {
    sampleName: sample?.name ?? '',
    origin: sample?.origin?.kind ?? null,
    chops: slices,
    hasPattern: !!chops?.events.length,
    hasDrums: !!drums?.events.length,
    bpm: project.bpm,
  }
}

/** Registro listo para IndexedDB. */
export function projectRecord(project, now = new Date().toISOString()) {
  return {
    id: project.id,
    name: project.name,
    updatedAt: now,
    summary: projectSummary(project),
    json: serializeProject(project, now),
  }
}

/** Nombre por defecto de un proyecto nuevo a partir de su audio. */
export function defaultProjectName(sampleName) {
  return sampleName ? `Beat con «${sampleName}»` : 'Mi primer beat'
}

/** Lo que se guarda del aprendizaje (sin el mensaje en pantalla). */
export function learningSnapshot(state) {
  const { progress, skipped, acked, seen, coachEnabled } = state
  return { progress, skipped, acked, seen, coachEnabled }
}

/** Mezcla lo guardado con el estado inicial (claves nuevas de versiones posteriores incluidas). */
export function restoreLearning(initial, saved) {
  if (!saved || typeof saved !== 'object') return initial
  return {
    ...initial,
    progress: { ...initial.progress, ...(saved.progress ?? {}) },
    skipped: Array.isArray(saved.skipped) ? saved.skipped : [],
    acked: Array.isArray(saved.acked) ? saved.acked : [],
    seen: Array.isArray(saved.seen) ? saved.seen : [],
    coachEnabled: saved.coachEnabled ?? initial.coachEnabled,
  }
}

/** «hace 3 min», «ayer»… para la lista de proyectos. */
export function relativeTime(iso, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'ahora mismo'
  if (s < 3600) return `hace ${Math.round(s / 60)} min`
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`
  const d = Math.round(s / 86400)
  return d === 1 ? 'ayer' : `hace ${d} días`
}
