/**
 * ChopTools — herramientas de corte. "Tijera" convierte la onda en una
 * superficie de corte: cada toque divide el chop en ese punto.
 */
import { MousePointer2, Scissors, SplitSquareHorizontal, Merge, Trash2, ArrowDownAZ, RefreshCcw } from 'lucide-react'
import { setUi } from '../state/uiStore'
import { splitAt, mergeWithNext, deleteSlice, sortPadsByTime, clearChops } from '../actions/samplerActions'

export default function ChopTools({ selected, tool, count }) {
  return (
    <div className="chop-tools" role="toolbar" aria-label="Herramientas de chop">
      <div className="segmented" role="radiogroup" aria-label="Modo">
        <button role="radio" aria-checked={tool === 'select'} className={`btn${tool === 'select' ? ' is-on' : ''}`}
          onClick={() => setUi({ chopTool: 'select' })}><MousePointer2 size={16} /> Tocar</button>
        <button role="radio" aria-checked={tool === 'cut'} className={`btn${tool === 'cut' ? ' is-on' : ''}`}
          onClick={() => setUi({ chopTool: 'cut' })}><Scissors size={16} /> Cortar</button>
      </div>
      {tool === 'cut' && <span className="tool-hint">Toca la onda donde quieras cortar.</span>}
      <span className="spacer" />
      <button className="btn" disabled={!selected} onClick={() => splitAt(null, selected.id)} title="Dividir el chop seleccionado por la mitad">
        <SplitSquareHorizontal size={16} /> <span className="lbl">Dividir</span>
      </button>
      <button className="btn" disabled={!selected} onClick={() => mergeWithNext(selected.id)} title="Unir con el chop de la derecha">
        <Merge size={16} /> <span className="lbl">Unir</span>
      </button>
      <button className="btn btn-danger" disabled={!selected || count < 2} onClick={() => deleteSlice(selected.id)} title="Borrar chop">
        <Trash2 size={16} /> <span className="lbl">Borrar</span>
      </button>
      <button className="btn btn-ghost" onClick={sortPadsByTime} title="Pads en el orden de la grabación">
        <ArrowDownAZ size={16} /> <span className="lbl">Ordenar</span>
      </button>
      <button className="btn btn-ghost" onClick={clearChops} title="Volver a elegir cómo cortar">
        <RefreshCcw size={16} /> <span className="lbl">Empezar cortes</span>
      </button>
    </div>
  )
}
