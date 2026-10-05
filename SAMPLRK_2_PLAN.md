# SAMPLRK 2.0 — Plan técnico

> «Nunca he sampleado. Enséñame haciéndolo.»
> Escuchar → Encontrar → Cortar → Choppear → Tocar → Grabar → Transformar → Batería → Primer beat

Este documento es el entregable de la **Fase 0 (auditoría)** y la definición de la **Fase 1**.
Se actualiza al cerrar cada fase.

---

## 1. Auditoría del repositorio (v0.1)

### 1.1 Estado de ejecución

| Comprobación | Resultado |
|---|---|
| `npm install` | ✅ sin errores (Node 22, npm 10) |
| `npm test` | ✅ 13/13 (DSP 11 + WAV 2) |
| `npm run build` | ✅ 200 kB JS (64 kB gzip), worker separado 4.5 kB |
| Dependencias | `react 18`, `react-dom 18`, `lucide-react` + `vite 5`, `vitest 2`. Mínimas y sanas. No hace falta añadir ninguna para la Fase 1. |

Tamaño total: ~2.600 líneas. Ningún archivo supera 370 líneas. La base es pequeña, limpia y ya respeta
«motores sin React».

### 1.2 Errores y problemas reales encontrados

| # | Dónde | Problema | Impacto |
|---|---|---|---|
| 1 | `exportEngine` + `sampleEngine.renderEditedData` | El pitch no se aplica al render: `exportSampleWav` dice «sample editado» pero exporta sin pitch. Los loops creados desde un sample con pitch también lo pierden. | Bug funcional |
| 2 | `audioEngine` | Todo se conecta directo a `ctx.destination`: sin master bus ni limitador. Varios pads/loops a la vez pueden saturar. | Clipping |
| 3 | `audioEngine` | `ctx.resume()` sin `await` ni gestión de `suspended/closed`; los errores de audio nunca llegan a la UI. | iOS/Safari: «no suena» sin explicación |
| 4 | `audioEngine.playPreview` | Una sola voz global: cualquier preview corta a la anterior. Válido para preescucha, imposible para pads. | Bloqueante para el sampler |
| 5 | `SampleEditor` canvas | Recorre **todas** las muestras del archivo en cada redibujado (incluido cada `pointermove` al seleccionar). Con 3 min de audio son ~8M iteraciones por frame. | Lag al arrastrar |
| 6 | `SampleEditor` rejilla | `Math.max(0, firstBeat - trimStart) % beat` pierde la fase si se recorta por detrás del primer beat. | Rejilla desplazada |
| 7 | `Transport.jsx` | `setState` de React a 60 fps durante la reproducción. | Re-renders innecesarios |
| 8 | `ImportView` | Promete FLAC y vídeo; dependen del navegador (Safari no abre OGG, Firefox no siempre M4A…). Mensaje de error genérico. | Expectativa rota |
| 9 | `actions.importFiles` | Sin límite de tamaño: un archivo de 1 h decodificado ocupa >1 GB de RAM. | Cuelgue de pestaña |
| 10 | Persistencia | Los `AudioBuffer` solo viven en memoria; refrescar pierde todo. `serializeProject` existe pero no se usa. | Pérdida de trabajo |
| 11 | `loopEngine.buildLoop` | Variable `energyScale` calculada y no usada. | Código muerto (menor) |
| 12 | `AssistantPanel` | `useStore(s => s)` re-renderiza el panel con cualquier cambio de estado. | Menor |

Ninguno rompe la build ni los tests. Los nº 2, 3, 4 y 5 se resuelven en la Fase 1 porque son la base del sampler.

### 1.3 Compatibilidad de navegador

- **Web Audio**: universal. Safari exige desbloqueo con gesto del usuario → pantalla de inicio con botón explícito.
- **`decodeAudioData`**: WAV y MP3 en todos. M4A/AAC: Chrome, Safari, Edge. OGG: no en Safari < 17 / iOS antiguo. FLAC: casi todos los actuales, pero no se promete.
- **Web Worker con `type: 'module'`**: Chrome 80+, Safari 15+, Firefox 114+. Suficiente.
- **Web MIDI**: Chrome/Edge/Opera, Firefox 108+ (con permiso). **No** Safari/iOS → el fallback teclado/touch es obligatorio (Fase 6).
- **IndexedDB**: universal (Fase 5).
- **`color-mix()` en CSS**: Chrome 111+, Safari 16.2+, Firefox 113+. Aceptable.

---

## 2. Qué se reutiliza

| Pieza actual | Decisión | Rol en SAMPLRK 2 |
|---|---|---|
| `dsp.js` | **Conservar íntegro** | Transitorios («golpes»), BPM, silencios, cruces por cero, validación de loops. Ayuda invisible. |
| `analysisWorker.js` + `analysisEngine.js` | **Conservar** | El análisis corre en segundo plano al cargar un sample; el usuario no ve números. |
| `sampleEngine.js` | **Conservar y extender** | `EditableSample` sigue siendo el modelo de sample. El «corte» (CUT) usa `edits.trimStart/trimEnd` (no destructivo). `uid()` y el registro de buffers se reutilizan. |
| `audioEngine.js` | **Extender** | Mismo `AudioContext` único. Se añade master bus + limitador, desbloqueo con estados y preview en bucle. El transporte/escenas legacy sigue funcionando. |
| `exportEngine.js` | **Conservar** | `encodeWav` + render offline. En Fase 2/4 se añade render de patterns. |
| `loopEngine.js` | **Conservar, secundario** | Fuera del flujo principal. `validateLoop` alimentará la misión «Loop» con mensajes humanos («el final y el principio no conectan»). |
| `aiAssistant.js` | **Sustituir por `coachEngine.js`** | El nuevo coach es determinista, observa lo que hace el usuario y habla **después** de la acción. `aiAssistant` queda en legacy. |
| `SampleEditor.jsx` | **Extraer** | Su lógica de canvas (min/max por píxel, zoom con rueda, selección por arrastre) se reescribe como `Waveform.jsx` reutilizable con caché de picos. |
| `LoopsView`, `ScenesView`, `TimelineView`, `projectEngine`, `timelineEngine`, `library` | **Legacy** | Siguen accesibles en `#/legacy`. Volverán en el «Modo avanzado» (Fase 8). |
| `store.js` | **Generalizar** | Se convierte en `createStore()` (mismo patrón `useSyncExternalStore`, sin dependencias). Se instancian stores separados. |
| `actions.js` | **Legacy** | Se mueve a `src/legacy/`. Las acciones nuevas viven en módulos pequeños por dominio. |
| Tests DSP/WAV | **Conservar** | Se añaden tests de slices, pitch, teclado, historial, coach, modelo de proyecto e importación. |

---

## 3. Arquitectura SAMPLRK 2

```
               ┌──────────────── UI (React) ────────────────┐
               │ Home · SourcePicker · CutLab · ChopLab      │
               │ Waveform · PadGrid · Pad · ChopInspector    │
               │ CoachLine · StepBar                         │
               └───────┬─────────────────────┬──────────────┘
                       │ llama               │ lee (selectores)
               ┌───────▼────────┐   ┌────────▼─────────────────┐
               │ actions/*      │──▶│ state/* (stores)          │
               │ sample/sampler │   │ project (serializable,    │
               │ /learning      │   │   con undo/redo)          │
               └───────┬────────┘   │ ui (pantalla, selección)  │
                       │            │ learning (progreso)       │
                       │            └──────────────────────────┘
               ┌───────▼──────────────── engines (sin React) ───────────┐
               │ audioEngine (ctx único, master bus, desbloqueo)         │
               │ samplerEngine (voces, pads, pitch, reverse, microfades) │
               │ sampleEngine (EditableSample + registro de buffers)     │
               │ analysisEngine → analysisWorker → dsp (golpes, BPM…)    │
               │ sliceModel · pitch · keyboardMap · coachEngine (puros)  │
               │ audioImport (formatos, límites, errores humanos)        │
               │ demo/ (samples de práctica sintetizados, sin derechos)  │
               │ exportEngine · loopEngine (secundario)                  │
               └─────────────────────────────────────────────────────────┘
```

### Principios que se mantienen
1. Los motores no importan React. La UI llama a acciones; las acciones a motores.
2. Edición no destructiva: el buffer original nunca se toca. Un slice es `{start, end}` sobre el buffer original.
3. DSP pesado en el worker.
4. Un solo `AudioContext`.

### Principios nuevos
5. **Tres tipos de reproducción separados**: preview (escuchar el sample, una voz, en bucle opcional), pads (polifónico, una voz por disparo) y patterns (Fase 2, scheduler con tiempo de AudioContext).
6. **Nada de audio en el estado serializable.** `AudioBuffer`, nodos y voces viven en el runtime de cada motor.
7. **El tiempo real no pasa por React.** Playheads y destellos de pads se pintan con `requestAnimationFrame`/refs; React solo re-renderiza en cambios estructurales.
8. **La app ayuda después, no antes.** El coach recibe eventos (golpes de pad, cambios de pitch…) y elige una frase; nunca modifica el proyecto por su cuenta.

### Ruta legacy
`#/legacy` carga la interfaz v0.1 completa (chunk y CSS separados, *lazy*). El resto de rutas cargan SAMPLRK 2.

---

## 4. Árbol de archivos propuesto

```
src/
  main.jsx                 router mínimo por hash (SAMPLRK 2 | #/legacy)
  App.jsx                  shell SAMPLRK 2: pantallas + teclado + coach
  styles/
    tokens.css             design system: color, espacio, radios, tipografía, estados
    app.css                componentes (botones, pads, waveform, tarjetas…)
  engines/
    audioEngine.js         ★ ampliado: master bus, unlock, preview en bucle
    samplerEngine.js       ★ nuevo: voces de pad, pitch, reverse, microfades, eventos
    sliceModel.js          ★ nuevo (puro): crear/dividir/unir/mover slices, pad bank
    pitch.js               ★ nuevo (puro): semitonos ↔ rate ↔ duración
    keyboardMap.js         ★ nuevo (puro): teclas ↔ pads
    coachEngine.js         ★ nuevo (puro): reglas del coach, detección de flip
    audioImport.js         ★ nuevo: decode con límites y errores comprensibles
    projectModel.js        ★ nuevo (puro): schema versionado + migraciones
    demo/
      synth.js             ★ nuevo: instrumentos sintetizados (EP, piano, bajo, batería)
      practiceSamples.js   ★ nuevo: catálogo de grabaciones de práctica originales
    sampleEngine.js  analysisEngine.js  analysisWorker.js  dsp.js
    exportEngine.js  loopEngine.js  projectEngine.js  timelineEngine.js
    library.js  aiAssistant.js     (sin cambios / legacy)
  state/
    createStore.js         fábrica de stores (patrón actual generalizado)
    history.js             undo/redo por snapshots ligeros (puro)
    projectStore.js        proyecto serializable + historial
    uiStore.js             pantalla, pad seleccionado, toasts, errores
    learningStore.js       progreso y frases del coach ya vistas
  actions/
    sampleActions.js       importar, demo, corte (CUT)
    samplerActions.js      chops, pads, pitch, reverse, disparo
    learningActions.js     eventos para el coach
  ui/
    Home.jsx  SourcePicker.jsx  CutLab.jsx  ChopLab.jsx
    Waveform.jsx  PadGrid.jsx  Pad.jsx  ChopInspector.jsx  ChopTools.jsx
    CoachLine.jsx  StepBar.jsx  Toast.jsx  hooks.js
  legacy/
    LegacyApp.jsx  actions.js  store.js  legacy.css
    ui/ (ImportView, SampleEditor, LoopsView, ScenesView, TimelineView, Transport, AssistantPanel)
tests/
  dsp.test.js  exportEngine.test.js            (existentes)
  sliceModel.test.js  pitch.test.js  keyboardMap.test.js
  history.test.js  coachEngine.test.js  projectModel.test.js  audioImport.test.js
```

Fases posteriores añadirán: `patternEngine.js`, `metronomeEngine.js`, `persistenceEngine.js`, `midiEngine.js`,
`PatternRecorder.jsx`, `TransformLab.jsx`, `DrumLab.jsx`, `BeatResult.jsx`, `MidiSetup.jsx`, `ProjectBrowser.jsx`.

---

## 5. Modelo de datos (schemaVersion 1)

```js
Project {
  schemaVersion: 1, id, name, createdAt, updatedAt,
  mode: 'learning' | 'free',
  bpm: number | null,            // null hasta que el usuario lo necesite
  samples: EditableSample[],     // modelo actual + `origin` (demo id / archivo)
  activeSampleId,
  slices: Slice[],
  padBanks: PadBank[],
  patterns: [],                  // Fase 2
  drumKit: null,                 // Fase 4
  settings: { keymap: 'default' },
}

EditableSample  // sin cambios estructurales; se añade:
  origin: { kind: 'demo', demoId } | { kind: 'file', fileName, mime }
  // CUT = edits.trimStart / edits.trimEnd (segundos del original)

Slice {
  id, sampleId,
  start, end,                    // segundos sobre el buffer ORIGINAL (no se copia audio)
  name, color,
  pitch: 0,                      // semitonos (-12…+12), estilo old school: cambia la duración
  gain: 1, reversed: false,
  triggerMode: 'oneshot',        // 'gate' en fases posteriores
  fadeInMs: 2, fadeOutMs: 6,     // micro-fades anti-clic en runtime
  keyBinding: null, midiNote: null,
}

PadBank { id, name, pads: (sliceId | null)[16] }   // un pad referencia un slice, nunca audio

Pattern { id, name, bars, bpm, events: [{ id, padId, time, beat, duration, velocity }] }  // Fase 2
```

Por qué slices sobre el original y no sobre el sample recortado: si el usuario cambia el corte,
los chops existentes no se desplazan; y el sampler reproduce con `source.start(t, slice.start)` sin renderizar nada.

**Runtime (nunca serializado):** `Map sampleId → AudioBuffer` (ya existe), caché de buffers invertidos,
caché de picos/mono para el waveform, voces activas.

**Undo/redo:** snapshots del proyecto (es JSON pequeño: sin audio). Los gestos continuos (arrastrar un límite,
mover el pitch) se agrupan en una sola entrada.

---

## 6. Riesgos técnicos

| Riesgo | Mitigación |
|---|---|
| **Latencia de pads** (sobre todo móvil/Bluetooth) | Disparo en `pointerdown` (no `click`), `latencyHint: 'interactive'`, cero React en el camino crítico. La latencia de salida del SO no se puede eliminar; se documenta. |
| **iOS: audio bloqueado / modo silencio** | Botón «Empezar» desbloquea el contexto; estado `suspended` se detecta y se muestra «Toca para activar el sonido». El interruptor de silencio del iPhone silencia Web Audio: se avisa en la pantalla de inicio. |
| **Clics al cortar** | Micro-fades por voz (2 ms entrada / 6 ms salida) con `GainNode`; el original no se toca. |
| **Saturación con muchas voces** | Master gain + `DynamicsCompressor` como limitador suave; límite de 24 voces con robo de la más antigua. |
| **`start(when, offset, duration)` y `playbackRate`** | No se usa el parámetro `duration` (su unidad es ambigua entre navegadores con rate ≠ 1): se programa `stop()` en tiempo de salida = duración / rate. |
| **Reverse sin copiar audio** | Un único buffer invertido por sample, creado bajo demanda y cacheado; el offset se refleja (`dur − end`). |
| **Archivos grandes** | Límite de 60 MB por archivo y 10 min de duración, con mensaje claro. |
| **Formatos no soportados** | Se prometen WAV y MP3; el resto «si tu navegador lo abre». Errores traducidos. |
| **Detector de golpes/BPM falla** | Nunca se aplica en silencio: solo sugiere. El usuario siempre puede cortar a mano. |
| **Samples de práctica con derechos** | Se sintetizan en el navegador con código propio (`OfflineAudioContext`): cero archivos de terceros, cero peso de descarga. |
| **Sin persistencia hasta Fase 5** | Refrescar pierde el proyecto en Fase 1–4. El modelo ya es serializable y versionado para que Fase 5 sea solo IndexedDB. |

---

## 7. Fase 1 — definición exacta

**Objetivo:** que tocar los pads sea divertido. Nada más.

```
HOME → DEMO / IMPORTAR → ESCUCHAR + «AQUÍ HAY ALGO» → CORTAR (inicio/fin, repetir)
     → CHOP LAB: ¿te sugiero cortes? [4] [8] [Detectar golpes] [Yo corto]
     → 8 PADS (ratón · touch · teclado) → PITCH y REVERSE por chop
```

Incluye:
- `Waveform` reutilizable (picos cacheados, zoom, selección con tiradores grandes, slices coloreados, playhead por rAF).
- Selección manual del fragmento con tiradores INICIO/FIN, escuchar selección y **Repetir** (bucle).
- Sugerencia «hay un golpe cerca» (no mueve nada salvo que el usuario lo pida).
- Chops: 4 / 8 / 16 iguales, detectar golpes, modo «Yo corto» (tocar la onda añade un corte), dividir, unir,
  borrar, mover límites, renombrar, reordenar pads.
- Pads 4×2 (o 4×4 con 16 chops), disparo en `pointerdown`, teclado `1 2 3 4 / Q W E R` (`A S D F / Z X C V` para 9–16).
- Relación bidireccional pad ↔ segmento (tocar pad resalta segmento; tocar segmento selecciona pad).
- Pitch por chop (−12…+12) con visualización de duración (ORIGINAL vs actual) y reverse por chop.
- Undo/redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) de todas las ediciones de chops.
- Coach mínimo (una línea, después de la acción): orden original → «prueba a romper el orden»; orden alterado →
  «eso ya es un flip»; cambio de pitch → «¿notas que también cambia la duración?».
- Samples de práctica originales (sintetizados) + importación WAV/MP3 con errores comprensibles.
- `#/legacy` con la interfaz anterior intacta.

No incluye (fases siguientes): grabación de patterns, metrónomo, batería, persistencia, MIDI, old school.

### Criterio de aceptación Fase 1
1. Desde Home, en ≤ 4 toques se está tocando un pad con el sample de práctica.
2. Importar WAV/MP3 funciona; un archivo inválido muestra un mensaje humano.
3. Seleccionar ~5 s, crear 8 chops, tocar cada uno con ratón, touch y teclado.
4. Pitch y reverse por chop audibles e independientes.
5. Tocar rápido no corta otros pads ni produce clics.
6. A 375 px: pads ≥ 72 px, sin scroll horizontal, sin controles diminutos.
7. `npm test` y `npm run build` en verde.

---

## 8. Rama

Este trabajo se desarrolla en la rama de la sesión (`claude/adoring-rubin-q40y5a`), que cumple el papel de
`samplrk-2-learning`: `master` sigue intacto y funcionando con la v0.1.

---

## 9. Estado de la Fase 1 (cerrada)

Verificado con `npm test` (63 tests), `npm run build` y recorridos automáticos en Chromium a 1280 px y 375 px:

| Criterio | Resultado |
|---|---|
| Home → tocar un pad con un disco de práctica | ✅ 4 toques (Empezar → Samplear este → Este es mi sample → 8 cortes) + pad |
| Importar WAV / archivo inválido | ✅ / ✅ «No he podido abrir este archivo de audio. Prueba con WAV o MP3.» |
| 8 chops, ratón + touch + teclado | ✅ un disparo por toque (sin doble disparo táctil) |
| Detectar golpes | ✅ cortes exactamente en los golpes del WAV de prueba |
| Dividir / unir / borrar / deshacer / «yo corto» / arrastrar bordes | ✅ |
| Pitch y reverse por chop | ✅ −4 st → rate 0,794; reverse lee el buffer invertido con offset reflejado |
| Coach después de la acción | ✅ A B C D → «prueba a romper el orden… empieza por C»; C C A D → «eso ya es un flip» |
| 375 px sin scroll horizontal, pads ≥ 72 px | ✅ pads de 86 px |
| `#/legacy` | ✅ interfaz v0.1 intacta, chunk y CSS separados |

### Limitaciones conocidas (previstas en fases siguientes)
- Sin persistencia: refrescar pierde el proyecto (Fase 5).
- Si se vuelve a CUT y se cambia el corte, los chops que quedan fuera se conservan (se ven atenuados); se decidirá en Fase 3 si se recortan o se avisa.
- «Modo libre» es, por ahora, el mismo recorrido con el coach apagado.
- La velocidad del pad es fija (sin presión/velocity hasta MIDI, Fase 6).
- Las fuentes se cargan de Google Fonts; sin red se usa la fuente del sistema.
- Probado en Chromium (escritorio y emulación móvil). Falta probar en Safari/iOS real.

### Decisiones tomadas tras la Fase 1
1. **Samples de práctica**: se añaden dos grabaciones reales de piano (josefpres, Freesound) aportadas como audio libre.
   Se incluyen fragmentos de 16 s (8 compases a 120 BPM) en WAV, con el nivel ajustado a −1 dBFS
   (créditos en `src/assets/practice/CREDITS.md`). Los discos sintetizados se mantienen.
   La licencia no se ha podido comprobar desde el entorno de desarrollo: revisar la página de cada sonido.
2. **Flip unificado**: *flip* = transformar el sample para que deje de funcionar como en la grabación original.
   Cuenta reordenar o repetir chops, cambiar el pitch o hacer reverse. El paso FLIP del recorrido se marca
   con cualquiera de ellos (también con el coach apagado) y lleva al Chop Lab, donde pitch y reverse aparecen
   agrupados bajo «Flip». El coach explica el término con la primera reordenación y recuerda que pitch y
   reverse también son flips.
3. **Teclado**: se mantiene `1 2 3 4 / Q W E R` (16 pads: `+ A S D F / Z X C V`).

---

## 10. Fase 2 — Pattern Recorder (cerrada)

**Objetivo:** grabar lo que tocas, oírlo en bucle y decidir; ajustar al ritmo solo si quieres.

Implementado:
- `patternEngine.js` (puro): eventos en **beats** (la toma sobrevive a cambios de BPM o pitch), golpes anticipados
  al «1» envueltos al final del loop, quantize **no destructivo** (`effectiveEvents`), ventanas de scheduling, tap tempo,
  ×2 / ÷2, BPM inicial (pista del disco → detector si se fía → 90).
- `sequencer.js`: scheduler *lookahead* (tick 25 ms, ventana 120 ms) sobre el reloj del AudioContext; cuenta atrás,
  grabación y bucle en la misma línea de tiempo; cambio de BPM sin saltos; la UI solo recibe cambios de fase.
- `metronomeEngine.js`: clics con acento y volumen independiente; opcional (apagado por defecto); la cuenta atrás siempre suena.
- Pantalla **RECORD**: tempo (± / ÷2 / ×2 / Tap, con «este disco va a 120 BPM»), pattern como bloques de colores del chop,
  playhead y cuenta atrás 4-3-2-1 por rAF, Grabar / Escuchar, 1-2-4 compases, cuenta atrás y metrónomo,
  **¿Te la quedas?** (Quedármela / Otra toma / Descartar), **antes/después** del quantize (Original · 1/4 · 1/8 · 1/16) con dos filas.
- El pad nunca se cuantiza al tocar: el golpe suena al instante y se anota con la hora real del AudioContext.
- Play/stop del pattern siempre visible en la barra superior: se puede dejar sonando y cambiar pitch/reverse en el Chop Lab.
- Coach: «has grabado tu primer pattern… SAMPLRK anota qué pad y cuándo, no audio», «esto se llama quantize», y al volver
  a Original «el groove no siempre significa tocar exactamente sobre la rejilla». Una toma reordenada también cuenta como flip.

Verificado (`npm test`: 86 tests; build; navegador a 1280 px y 375 px):
- 8 golpes tocados a tiempos conocidos a 120 BPM → anotados con ±0,02 beats (≈10 ms), incluido uno fuera de rejilla (1,62 → 1,64).
- Quantize 1/4 → [0, 1, 2, 2, 4, 5, 6, 7] con la toma original visible encima; deshacer devuelve el ajuste anterior.
- La toma suena en bucle tras grabar; Quedármela / Otra toma; paso RECORD marcado; sin scroll horizontal a 375 px.

Limitaciones conocidas:
- Sin compensación de latencia de salida (con auriculares Bluetooth la toma puede quedar algo retrasada). Fase futura: calibración.
- Un solo pattern por proyecto y una sola toma (sin overdub ni tomas múltiples, previstas para más adelante).
- En segundo plano el navegador frena los temporizadores: el pattern puede trastabillar si la pestaña no está visible.
- Sigue sin persistencia (Fase 5).
