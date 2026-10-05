/**
 * persistenceEngine.js — guardado local en IndexedDB (sin dependencias, sin backend).
 *
 * Almacenes:
 *   projects → { id, name, updatedAt, summary, json }   el proyecto serializado (versionado)
 *   audio    → { id, blob, name, type }                 el ARCHIVO original importado (nunca AudioBuffer)
 *   meta     → { key, value }                           último proyecto, aprendizaje, preferencias…
 *
 * Los discos de práctica no se guardan: se regeneran idénticos al abrir.
 * Todas las funciones lanzan Error con un mensaje comprensible.
 */
const DB_NAME = 'samplrk'
const DB_VERSION = 1

let dbPromise = null

export function isPersistenceAvailable() {
  try { return typeof indexedDB !== 'undefined' && indexedDB !== null } catch { return false }
}

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!isPersistenceAvailable()) { reject(new Error('Este navegador no permite guardar proyectos (¿modo privado?).')); return }
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(new Error('No puedo abrir el almacenamiento del navegador.'))
      req.onblocked = () => reject(new Error('Cierra otras pestañas de SAMPLRK y vuelve a intentarlo.'))
    }).catch(err => { dbPromise = null; throw err })
  }
  return dbPromise
}

function friendly(err) {
  if (err?.name === 'QuotaExceededError') return new Error('No queda espacio para guardar en este navegador. Borra algún proyecto antiguo.')
  return err instanceof Error && !/^(DOMException|InvalidStateError|UnknownError)/.test(err.message) ? err : new Error('No he podido guardar en este navegador.')
}

async function run(store, mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const req = fn(tx.objectStore(store))
    let result
    if (req) req.onsuccess = () => { result = req.result }
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(friendly(tx.error))
    tx.onabort = () => reject(friendly(tx.error))
  })
}

// ---------------------------------------------------------------- proyectos

export function putProjectRecord(record) { return run('projects', 'readwrite', s => s.put(record)) }
export function getProjectRecord(id) { return run('projects', 'readonly', s => s.get(id)) }
export async function listProjectRecords() {
  const all = (await run('projects', 'readonly', s => s.getAll())) ?? []
  return all.map(({ json, ...rest }) => rest).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
}
export function deleteProjectRecord(id) { return run('projects', 'readwrite', s => s.delete(id)) }

// ---------------------------------------------------------------- audio

export async function putAudio(id, blob, name = '') {
  try {
    return await run('audio', 'readwrite', s => s.put({ id, blob, name, type: blob.type }))
  } catch (err) {
    if (err?.message?.includes('espacio')) throw err
    // algunos Safari no guardan Blob en IndexedDB: se guardan los bytes
    const bytes = await blob.arrayBuffer()
    return run('audio', 'readwrite', s => s.put({ id, bytes, name, type: blob.type }))
  }
}
export async function getAudio(id) {
  const rec = await run('audio', 'readonly', s => s.get(id))
  if (rec && !rec.blob && rec.bytes) rec.blob = new Blob([rec.bytes], { type: rec.type || 'application/octet-stream' })
  return rec
}
export function deleteAudio(id) { return run('audio', 'readwrite', s => s.delete(id)) }

// ---------------------------------------------------------------- meta

export async function getMeta(key) { return (await run('meta', 'readonly', s => s.get(key)))?.value }
export function setMeta(key, value) { return run('meta', 'readwrite', s => s.put({ key, value })) }
export function deleteMeta(key) { return run('meta', 'readwrite', s => s.delete(key)) }

/** Pide al navegador que no borre los datos si le falta espacio (mejor esfuerzo). */
export async function requestPersistentStorage() {
  try { return await navigator.storage?.persist?.() } catch { return false }
}
