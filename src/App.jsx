import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useStore } from './state/store'
import { gotoView } from './app/actions'
import Transport from './ui/Transport'
import ImportView from './ui/ImportView'
import SampleEditor from './ui/SampleEditor'
import LoopsView from './ui/LoopsView'
import ScenesView from './ui/ScenesView'
import TimelineView from './ui/TimelineView'
import AssistantPanel from './ui/AssistantPanel'

const TABS = [
  ['import', 'Importar'],
  ['editor', 'Editor'],
  ['loops', 'Loops'],
  ['scenes', 'Escenas'],
  ['timeline', 'Timeline'],
]

export default function App() {
  const view = useStore(s => s.view)
  const busy = useStore(s => s.busy)
  const toast = useStore(s => s.toast)
  const [assistOpen, setAssistOpen] = useState(false)

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">SAMPL<span>RK</span></div>
        <nav className="tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={`tab${view === id ? ' active' : ''}`} onClick={() => gotoView(id)}>
              {label}
            </button>
          ))}
        </nav>
        <Transport />
      </header>

      <div className="body">
        <main className="main">
          {view === 'import' && <ImportView />}
          {view === 'editor' && <SampleEditor />}
          {view === 'loops' && <LoopsView />}
          {view === 'scenes' && <ScenesView />}
          {view === 'timeline' && <TimelineView />}
        </main>
        <AssistantPanel open={assistOpen} onClose={() => setAssistOpen(false)} />
      </div>

      <button className="assistant-toggle" onClick={() => setAssistOpen(o => !o)} aria-label="Asistente">
        <Sparkles size={22} />
      </button>

      {busy && (
        <>
          <div className="busy"><i /></div>
          <div className="busy-label">{busy}</div>
        </>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
