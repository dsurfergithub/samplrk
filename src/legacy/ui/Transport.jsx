import { useEffect, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { useStore } from '../store'
import { useTransport } from './hooks'
import { startTransport, stopTransport, currentBar } from '../../engines/audioEngine'
import { setProjectBpm, stopEverything } from '../actions'

export default function Transport() {
  const t = useTransport()
  const bpm = useStore(s => s.bpm)
  const [pos, setPos] = useState('1.1')

  useEffect(() => {
    if (!t.playing) { setPos('1.1'); return }
    let raf
    const tick = () => {
      const bar = currentBar()
      setPos(`${Math.floor(bar) + 1}.${Math.floor((bar % 1) * 4) + 1}`)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [t.playing])

  return (
    <div className="transport">
      <div className={`eq${t.playing ? ' on' : ''}`}><i /><i /><i /><i /></div>
      <div className="pos"><b>{pos}</b> · 4/4</div>
      <div className="bpm-box">
        BPM
        <input
          type="number" min="40" max="220" value={Math.round(bpm * 10) / 10}
          onChange={e => setProjectBpm(Number(e.target.value) || 120)}
        />
      </div>
      {t.playing ? (
        <button className="btn btn-icon" onClick={() => { stopEverything(); stopTransport() }} title="Detener todo">
          <Square size={16} />
        </button>
      ) : (
        <button className="btn btn-primary btn-icon" onClick={startTransport} title="Iniciar transporte">
          <Play size={16} />
        </button>
      )}
    </div>
  )
}
