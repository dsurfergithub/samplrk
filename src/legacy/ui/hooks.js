import { useSyncExternalStore } from 'react'
import { subscribeTransport, getTransport } from '../../engines/audioEngine'

/** Estado en vivo del transporte (playing, bpm, loops activos). */
export function useTransport() {
  return useSyncExternalStore(subscribeTransport, getTransport)
}
