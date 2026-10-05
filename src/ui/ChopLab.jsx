/**
 * ChopLab — CHOP + PLAY. La pantalla central de SAMPLRK.
 * De un vistazo: qué audio tengo, dónde están los cortes, qué trozo es cada
 * pad y qué pad está sonando. Pad ↔ segmento funcionan en las dos direcciones.
 */
import { useMemo } from 'react'
import { Scissors, Grid2x2, Grid3x3, AudioWaveform, ArrowRight } from 'lucide-react'
import Waveform from './Waveform'
import PadGrid from './PadGrid'
import ChopTools from './ChopTools'
import ChopInspector from './ChopInspector'
import CoachLine from './CoachLine'
import MissionHead from './MissionHead'
import MemoryMeter from './MemoryMeter'
import { oldSchoolOf } from '../engines/oldSchool'
import { useLearning } from '../state/learningStore'
import { currentMission } from '../engines/missions'
import { useProject } from '../state/projectStore'
import { useUi } from '../state/uiStore'
import { getActiveBuffer, cutRegion, goto } from '../actions/sampleActions'
import { createChops, hitSlice, moveSliceEdge, splitAt } from '../actions/samplerActions'
import { padLetter } from '../engines/sliceModel'
import { liveState, useActiveBuffer } from './hooks'

export default function ChopLab() {
  const sample = useProject(p => p.samples.find(s => s.id === p.activeSampleId))
  const allSlices = useProject(p => p.slices)
  const pads = useProject(p => p.padBanks[0].pads)
  const selectedSliceId = useUi(s => s.selectedSliceId)
  const tool = useUi(s => s.chopTool)
  const mode = useProject(p => p.mode)
  const osRaw = useProject(p => p.settings?.oldSchool)
  const os = oldSchoolOf({ settings: { oldSchool: osRaw } })
  const noHelpers = os.enabled && os.noHelpers
  const missionHere = useLearning(s => {
    const m = currentMission(s.progress, s.skipped)
    return mode === 'learning' && !s.exploring && !!m && m.screens.includes('chop')
  })
  const buffer = useActiveBuffer()

  const slices = useMemo(() => allSlices.filter(s => s.sampleId === sample?.id), [allSlices, sample?.id])
  const slicesById = useMemo(() => new Map(slices.map(s => [s.id, s])), [slices])
  const labeled = useMemo(() => slices.map(s => {
    const i = pads.indexOf(s.id)
    return { ...s, label: i >= 0 ? padLetter(i) : '·' }
  }), [slices, pads])

  if (!sample || !buffer) return null
  const region = cutRegion(sample)
  const pad = Math.min(0.25, (region.end - region.start) * 0.04)
  const fit = { t0: Math.max(0, region.start - pad), t1: Math.min(buffer.duration, region.end + pad) }
  const selected = slicesById.get(selectedSliceId) ?? null
  const hasChops = slices.length > 0

  return (
    <section className="chop">
      <MissionHead screen="chop"
        eyebrow={hasChops ? ['Play', 'Toca'] : ['Chop', 'Divide']}
        title={hasChops ? 'Ahora tócalos.' : 'Vamos a trocear tu sample.'}
        sub={hasChops
          ? 'Toca los pads con el dedo, el ratón o el teclado. Primero en orden… y después como quieras.'
          : 'Cada trozo irá a un pad. Puedo sugerirte cortes, o puedes hacerlos tú.'} />
      <CoachLine />
      <MemoryMeter />

      <Waveform
        buffer={buffer} fit={fit} region={region}
        slices={labeled} selectedSliceId={selectedSliceId}
        onSliceDown={tool === 'cut' ? null : hitSlice}
        onEdgeDrag={moveSliceEdge}
        tool={tool} onTapTime={tool === 'cut' ? (t) => splitAt(t) : null}
        getLive={liveState} className="wave-chop"
        label={`Tu sample con ${slices.length} chops`}
      />

      {!hasChops ? (
        <div className="suggest">
          <p className="suggest-q">¿Quieres que te sugiera cortes?</p>
          <div className="suggest-grid">
            <button className="btn btn-big" onClick={() => createChops(4)}><Grid2x2 size={18} /> 4 cortes</button>
            <button className="btn btn-big" onClick={() => createChops(8)}><Grid3x3 size={18} /> 8 cortes</button>
            <button className="btn btn-big" onClick={() => createChops('hits')} disabled={noHelpers}
              title={noHelpers ? 'Old School sin ayudas: corta a oído, como entonces' : undefined}><AudioWaveform size={18} /> Detectar golpes</button>
            <button className="btn btn-big" onClick={() => createChops('manual')}><Scissors size={18} /> Yo corto</button>
          </div>
        </div>
      ) : (
        <>
          <ChopTools selected={selected} tool={tool} count={slices.length} />
          <div className="chop-play">
            <PadGrid pads={pads} slicesById={slicesById} buffer={buffer} selectedSliceId={selectedSliceId} />
            {selected && <ChopInspector slice={selected} letter={padLetter(pads.indexOf(selected.id))} />}
          </div>
          {!missionHere && <div className="next-bar">
            <p>¿Ya tienes una frase que te guste? Puedes seguir aquí experimentando todo lo que quieras.</p>
            <button className="btn btn-primary" onClick={() => goto('record')}>Graba lo que tocas <ArrowRight size={16} /></button>
          </div>}
        </>
      )}
    </section>
  )
}
