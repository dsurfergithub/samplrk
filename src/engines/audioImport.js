/**
 * audioImport.js — abrir archivos de audio sin prometer lo que el navegador
 * no puede hacer, y traducir los errores a frases comprensibles.
 */

export const MAX_FILE_MB = 60
export const MAX_DURATION_SEC = 600

/** Formatos que SAMPLRK promete (todos los navegadores los abren). */
export const GUARANTEED = ['wav', 'mp3']
/** Formatos que se intentan si el navegador los soporta. */
export const BEST_EFFORT = ['m4a', 'aac', 'ogg', 'oga', 'opus', 'flac', 'webm']

const MIME_BY_EXT = {
  wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac',
  ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg; codecs=opus', flac: 'audio/flac', webm: 'audio/webm',
}

export const ACCEPT_ATTR = [...GUARANTEED, ...BEST_EFFORT].map(e => '.' + e).join(',') + ',audio/*'

export function extensionOf(name = '') {
  const m = /\.([a-z0-9]+)$/i.exec(name)
  return m ? m[1].toLowerCase() : ''
}

/**
 * Comprobación previa (sin decodificar). `canPlay(mime)` permite inyectar
 * `HTMLMediaElement.canPlayType` en el navegador y probarlo en tests.
 * Devuelve { ok: true } o { ok: false, message }.
 */
export function checkFile(file, canPlay = null) {
  const ext = extensionOf(file.name)
  const isVideo = file.type?.startsWith('video/')
  if (isVideo) {
    return { ok: false, message: 'Por ahora SAMPLRK solo abre audio. Prueba con un WAV o un MP3.' }
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return {
      ok: false,
      message: `El archivo es muy grande (${Math.round(file.size / 1048576)} MB). Para samplear basta con un fragmento: prueba con algo de menos de ${MAX_FILE_MB} MB.`,
    }
  }
  if (!GUARANTEED.includes(ext) && BEST_EFFORT.includes(ext) && canPlay) {
    if (!canPlay(MIME_BY_EXT[ext])) {
      return { ok: false, message: `Tu navegador no puede abrir archivos .${ext}. Prueba con WAV o MP3.` }
    }
  }
  if (ext && !GUARANTEED.includes(ext) && !BEST_EFFORT.includes(ext) && !file.type?.startsWith('audio/')) {
    return { ok: false, message: `No reconozco «.${ext}» como audio. Prueba con WAV o MP3.` }
  }
  return { ok: true }
}

/** Traduce cualquier error técnico de audio a un mensaje humano. */
export function friendlyAudioError(err, context = 'decode') {
  const name = err?.name ?? ''
  if (context === 'decode') {
    return 'No he podido abrir este archivo de audio. Prueba con WAV o MP3.'
  }
  if (context === 'unlock') {
    if (name === 'NotAllowedError') return 'El navegador no deja sonar el audio todavía. Toca la pantalla para activarlo.'
    return 'No he podido activar el sonido. Recarga la página e inténtalo otra vez.'
  }
  if (context === 'unsupported') {
    return 'Este navegador no tiene audio web. Prueba con Chrome, Edge, Firefox o Safari actualizados.'
  }
  return 'Algo ha fallado con el audio. Inténtalo de nuevo.'
}

/** Decodifica un File con un AudioContext. Lanza Error con mensaje humano. */
export async function decodeFile(file, ctx) {
  const check = checkFile(file, (mime) => {
    try { return document.createElement('audio').canPlayType(mime) !== '' } catch { return true }
  })
  if (!check.ok) throw new Error(check.message)
  let buffer
  try {
    const ab = await file.arrayBuffer()
    buffer = await ctx.decodeAudioData(ab)
  } catch {
    throw new Error(friendlyAudioError(null, 'decode'))
  }
  if (buffer.duration > MAX_DURATION_SEC) {
    throw new Error(`La grabación dura ${Math.round(buffer.duration / 60)} minutos. SAMPLRK trabaja con fragmentos de hasta ${MAX_DURATION_SEC / 60} minutos: recorta antes el trozo que te interese.`)
  }
  if (buffer.duration < 0.1) {
    throw new Error('El archivo es demasiado corto para samplear (menos de una décima de segundo).')
  }
  return buffer
}
