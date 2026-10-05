/**
 * App — shell de SAMPLRK 2. Sin pestañas de DAW: una pantalla cada vez,
 * un recorrido sugerido y libertad para moverse.
 */
import './styles/tokens.css'
import './styles/base.css'
import './styles/screens.css'
import './styles/pads.css'
import './styles/record.css'
import './styles/learning.css'
import './styles/drums.css'
import './styles/projects.css'
import { Undo2, Redo2, Lightbulb, LightbulbOff } from 'lucide-react'
import { useUi } from './state/uiStore'
import { useEffect } from 'react'
import { useHistory, useProject, undo, redo } from './state/projectStore'
import { applyMix } from './actions/mixActions'
import { bootPersistence } from './actions/projectActions'
import SaveIndicator from './ui/SaveIndicator'
import { useLearning } from './state/learningStore'
import { setCoachEnabled } from './actions/learningActions'
import { goto } from './actions/sampleActions'
import { useGlobalKeys } from './ui/hooks'
import Home from './ui/Home'
import SourcePicker from './ui/SourcePicker'
import CutLab from './ui/CutLab'
import ChopLab from './ui/ChopLab'
import RecordLab from './ui/RecordLab'
import BeatResult from './ui/BeatResult'
import TransportMini from './ui/TransportMini'
import ProgressPanel from './ui/ProgressPanel'
import StepBar from './ui/StepBar'
import Toast from './ui/Toast'
import AudioGate from './ui/AudioGate'

const DrumsScreen = () => <RecordLab track="drums" />
const SCREENS = { source: SourcePicker, cut: CutLab, chop: ChopLab, record: RecordLab, drums: DrumsScreen, beat: BeatResult }

export default function App() {
  const screen = useUi(s => s.screen)
  const canUndo = useHistory(h => h.past.length > 0)
  const canRedo = useHistory(h => h.future.length > 0)
  const coachOn = useLearning(s => s.coachEnabled)
  useGlobalKeys()
  const mix = useProject(p => p.settings?.mix)
  useEffect(() => { applyMix() }, [mix])
  useEffect(() => { bootPersistence() }, [])

  if (screen === 'home') return <div className="shell"><Home /><Toast /></div>

  const Screen = SCREENS[screen] ?? SourcePicker
  return (
    <div className="shell">
      <header className="topbar">
        <button className="logo" onClick={() => goto('home')} aria-label="SAMPLRK, inicio">SAMPL<b>RK</b></button>
        <StepBar />
        <div className="topbar-actions">
          <SaveIndicator />
          <TransportMini />
          <ProgressPanel />
          <button className="btn btn-ghost btn-icon" onClick={undo} disabled={!canUndo} aria-label="Deshacer" title="Deshacer (Ctrl/Cmd+Z)"><Undo2 size={18} /></button>
          <button className="btn btn-ghost btn-icon" onClick={redo} disabled={!canRedo} aria-label="Rehacer" title="Rehacer (Ctrl/Cmd+Shift+Z)"><Redo2 size={18} /></button>
          <button className={`btn btn-ghost btn-icon${coachOn ? '' : ' is-off'}`} onClick={() => setCoachEnabled(!coachOn)}
            aria-pressed={coachOn} aria-label={coachOn ? 'Silenciar coach' : 'Activar coach'} title={coachOn ? 'Coach activado' : 'Coach desactivado'}>
            {coachOn ? <Lightbulb size={18} /> : <LightbulbOff size={18} />}
          </button>
        </div>
      </header>
      <AudioGate />
      <main className="main"><Screen /></main>
      <Toast />
    </div>
  )
}
