/**
 * MidiPanel — MIDI SETUP. Opcional: SAMPLRK se toca igual sin MIDI.
 * «Pulsa una tecla de tu controlador» → «Detectado» → asignar notas a pads.
 */
import { useEffect, useRef, useState } from 'react'
import { Piano, X, Usb } from 'lucide-react'
import { useMidi } from '../state/midiStore'
import { useProject } from '../state/projectStore'
import { useUi } from '../state/uiStore'
import { enableMidi, disableMidi, startLearn, cancelLearn, resetMidiMap, targetLabel } from '../actions/midiActions'
import { noteName, notesFor } from '../engines/midiMap'
import { visiblePadCount, padLetter } from '../engines/sliceModel'
import { DRUM_PADS } from '../engines/drumKit'

function MapRows({ kind }) {
  const { map, learn } = useMidi(s => s)
  const pads = useProject(p => p.padBanks[0].pads)
  const targets = kind === 'drums'
    ? DRUM_PADS.map(d => ({ kind: 'drums', id: d.id }))
    : Array.from({ length: visiblePadCount(pads) }, (_, i) => ({ kind: 'chops', pad: i }))
  return (
    <ul className="midi-map">
      {targets.map(t => {
        const key = t.kind === 'drums' ? t.id : t.pad
        const waiting = learn && learn.kind === t.kind && (learn.id ?? learn.pad) === key
        const notes = notesFor(map, t)
        return (
          <li key={key} className={waiting ? 'is-learning' : ''}>
            <span className="midi-target">{t.kind === 'drums' ? targetLabel(t) : padLetter(t.pad)}</span>
            <span className="midi-notes">{notes.length ? notes.map(noteName).join(' · ') : 'sin nota'}</span>
            {waiting
              ? <button className="btn btn-ghost" onClick={cancelLearn}>Cancelar</button>
              : <button className="btn" onClick={() => startLearn(t)} aria-label={`Aprender nota para ${targetLabel(t)}`}>Aprender</button>}
          </li>
        )
      })}
    </ul>
  )
}

export default function MidiPanel() {
  const [open, setOpen] = useState(false)
  const screen = useUi(s => s.screen)
  const [tab, setTab] = useState('chops')
  const ref = useRef(null)
  const { status, devices, last, learn } = useMidi(s => s)

  useEffect(() => { if (open) setTab(screen === 'drums' ? 'drums' : 'chops') }, [open])
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') { cancelLearn(); setOpen(false) } }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  const connected = devices.filter(d => d.state === 'connected')
  return (
    <div className="progress midi" ref={ref}>
      <button className={`btn btn-ghost btn-icon midi-toggle${status === 'on' ? ' is-on-midi' : ''}${status === 'unsupported' ? ' is-unsupported' : ''}`}
        onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="midi-panel"
        aria-label="MIDI" title={status === 'on' ? `MIDI activo (${connected.length})` : 'MIDI'}>
        <Piano size={18} />
      </button>
      {open && (
        <section id="midi-panel" className="progress-panel midi-panel" aria-label="MIDI">
          <header className="row">
            <h3>MIDI</h3>
            <span className="spacer" />
            <button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={16} /></button>
          </header>

          {status === 'unsupported' && (
            <p className="midi-msg">Este navegador no tiene MIDI (Safari no lo incluye). Para usar un controlador, abre SAMPLRK en Chrome.
              Mientras, toca con el teclado (<b>1 2 3 4 · Q W E R</b>, batería <b>J K L Ñ</b>) o con la pantalla.</p>
          )}
          {(status === 'off' || status === 'error') && (
            <>
              <p className="midi-msg">Conecta un teclado o un controlador de pads por USB y actívalo. No es obligatorio: todo se puede tocar sin él.</p>
              <button className="btn btn-primary" onClick={() => enableMidi()}><Usb size={16} /> Activar MIDI</button>
            </>
          )}
          {status === 'asking' && <p className="midi-msg">Esperando permiso del navegador…</p>}
          {status === 'denied' && (
            <>
              <p className="midi-msg">El navegador no ha dado permiso para MIDI. Puedes permitirlo en los ajustes del sitio (icono junto a la dirección) y volver a intentarlo.</p>
              <button className="btn" onClick={() => enableMidi()}>Intentarlo otra vez</button>
            </>
          )}

          {status === 'on' && (
            <>
              <ul className="midi-devices">
                {connected.length
                  ? connected.map(d => <li key={d.id}><i className="dot-on" /> {d.name}</li>)
                  : <li className="muted">No veo ningún controlador. Conéctalo y aparecerá aquí.</li>}
              </ul>
              <p className={`midi-activity${last ? ' is-live' : ''}`} aria-live="polite">
                {learn ? <>Pulsa una tecla de tu controlador para <b>{targetLabel(learn)}</b>…</>
                  : last ? <>Detectado: <b>{noteName(last.note)}</b> · fuerza {last.velocity} → {last.target ? targetLabel(last.target) : 'sin asignar'}</>
                  : 'Pulsa una tecla de tu controlador.'}
              </p>
              <div className="segmented" role="radiogroup" aria-label="Mapa">
                {[['chops', 'Chops'], ['drums', 'Batería']].map(([id, label]) => (
                  <button key={id} role="radio" aria-checked={tab === id} className={`btn${tab === id ? ' is-on' : ''}`} onClick={() => setTab(id)}>{label}</button>
                ))}
              </div>
              <MapRows kind={tab} />
              <div className="row">
                <button className="link-btn" onClick={resetMidiMap}>Restablecer mapa</button>
                <span className="spacer" />
                <button className="link-btn" onClick={disableMidi}>Desactivar MIDI</button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
