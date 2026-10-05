/**
 * AudioGate — si el navegador suspende el audio (pestaña en segundo plano,
 * iOS, llamada entrante…), lo decimos claro y se reactiva con un toque.
 */
import { useSyncExternalStore } from 'react'
import { Volume2 } from 'lucide-react'
import { subscribeAudioState, getAudioState } from '../engines/audioEngine'
import { startAudio } from '../actions/sampleActions'

export default function AudioGate() {
  const state = useSyncExternalStore(subscribeAudioState, getAudioState)
  if (state !== 'suspended' && state !== 'interrupted' && state !== 'closed') return null
  return (
    <button className="audio-gate" onClick={startAudio}>
      <Volume2 size={18} /> El sonido está en pausa. <b>Toca aquí para activarlo.</b>
    </button>
  )
}
