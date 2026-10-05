# SAMPLRK — Arquitectura

> **SAMPLRK 2**: «Nunca he sampleado. Enséñame haciéndolo.»
> Escuchar → Encontrar → Cortar → Choppear → Tocar → (Grabar → Transformar → Batería → Beat)

La interfaz v0.1 (Archivo → Loop → Escenas → Timeline) sigue disponible en `#/legacy`.
El plan por fases está en [SAMPLRK_2_PLAN.md](SAMPLRK_2_PLAN.md).

## Principios

1. **Los motores no conocen React.** `src/engines/*` trabaja con datos y Web Audio; la UI llama a acciones (`src/actions/*`), las acciones a motores.
2. **Edición no destructiva.** El buffer original nunca se toca. Un corte es `edits.trimStart/trimEnd`; un chop es `{ start, end }` sobre el original.
3. **Nada de audio en el estado.** `AudioBuffer`, nodos y voces viven en el runtime de cada motor. El proyecto es JSON versionado.
4. **El tiempo real no pasa por React.** Playheads y destellos de pads se pintan con `requestAnimationFrame` y clases en el DOM.
5. **La app ayuda después, no antes.** El coach observa eventos y, como mucho, dice una frase. Nunca modifica el proyecto.
6. **DSP pesado en un Web Worker**, render de export con `OfflineAudioContext`, **un único `AudioContext`**.

## Capas

```
ui/ (React)  ──llama──▶  actions/  ──▶  engines/ (sin React)
     ▲                      │
     └──── lee ──── state/ ◀┘   project (serializable + undo) · ui · learning
```

## Motores

| Motor | Fichero | Responsabilidad |
|---|---|---|
| **Audio runtime** | `audioEngine.js` | `AudioContext` único (`latencyHint: 'interactive'`), master bus (ganancia → limitador suave), desbloqueo con estados `suspended/running/closed`, preescucha (una voz, en bucle opcional, con posición para playheads). Mantiene el transporte/escenas de v0.1. |
| **Sampler** | `samplerEngine.js` | Voces de pad (chops y batería), buses con volumen (`chops`, `drums`), choke groups y `buildVoice` compartido con el export. Cada disparo = un `AudioBufferSourceNode` nuevo sobre el buffer original con offset (sin copiar audio). Pitch por `playbackRate` (old school: cambia la duración). Reverse con un buffer invertido cacheado por sample. Micro-fades anti-clic, polifonía con robo de voz, re-disparo del mismo pad corta su voz anterior. Emite eventos `start/end` para la UI. |
| **Sample** | `sampleEngine.js` | `EditableSample` (sin cambios de v0.1) y registro runtime `id → AudioBuffer`. |
| **Slices** | `sliceModel.js` | Puro. Crear (iguales / en golpes), dividir, unir, borrar, mover bordes enlazados; banco de 16 pads que referencia slices por id; orden original para el coach. |
| **Patterns** | `patternEngine.js` | Puro. Eventos en beats (no audio), quantize no destructivo, ventanas para el scheduler, tap tempo y BPM inicial. |
| **Secuenciador** | `sequencer.js` | Scheduler *lookahead* (25 ms / 120 ms) sobre el reloj del AudioContext: cuenta atrás, grabación y bucle; cambio de tempo sin saltos. La UI consulta `position()` por rAF y solo se suscribe a cambios de fase. |
| **Batería** | `drumKit.js` | Kit sintetizado (bombo, caja, charles cerrado/abierto), teclas J K L Ñ, choke del charles; cada pieza se toca como un slice en el mismo sampler. |
| **Plan del beat** | `beatPlan.js` | Puro. Golpes de chops + batería con su hora y su corte (re-disparo y choke); resumen objetivo del beat. |
| **Export del beat** | `beatRenderer.js` | OfflineAudioContext con la misma receta que en vivo (`buildVoice`, buses, master + limitador) siguiendo el plan. |
| **Metrónomo** | `metronomeEngine.js` | Clics con acento y volumen propio; cancelables al parar. |
| **Pitch** | `pitch.js` | Puro. Semitonos ↔ rate ↔ duración. |
| **Teclado** | `keyboardMap.js` | Puro. `KeyboardEvent.code` → pad (`1 2 3 4 / Q W E R / A S D F / Z X C V`). |
| **Coach** | `coachEngine.js` | Puro y determinista. Define *flip* de forma única (`flipKind`: reordenar/repetir chops, pitch o reverse = transformar el sample respecto al original). Clasifica frases (orden original / flip / stutter) y reacciona a eventos (`cut:confirmed`, `loop:on`, `chops:created`, `pad:hit`, `pitch:changed`, `reverse:on`). Mensajes `learned` (vocabulario, una vez) y `hint` (ignorables). |
| **Misiones** | `missions.js` | Puro. Las 9 misiones del Modo Aprendizaje (pantalla, instrucción, condición de cumplimiento, texto de éxito, dato histórico opcional), misión actual, «recién cumplida», lista Sampling Basics y mensajes del coach que una misión ya cubre. |
| **Cortes** | `cutHints.js` | Puro. «Hay un golpe cerca del inicio» y «el loop no empalma», en lenguaje humano. Solo sugiere. |
| **Análisis** | `analysisEngine.js` → `analysisWorker.js` → `dsp.js` | BPM, fase, tonalidad, golpes (transitorios), silencios, energía. Corre en segundo plano al abrir un audio; alimenta «Detectar golpes» y las pistas de corte. |
| **Onda** | `waveformPeaks.js` | Mono + tabla min/max por bloques de 128 muestras, cacheada por buffer. Dibujar una columna agrega bloques, no muestras. |
| **Importación** | `audioImport.js` | Formatos garantizados (WAV, MP3) y «si tu navegador puede» (M4A, OGG, FLAC…), límites (60 MB / 10 min), errores traducidos. |
| **Proyecto** | `projectModel.js` | Schema versionado (`schemaVersion: 1`), serialización y migraciones (incluida la de v0.1). |
| **Práctica** | `demo/practiceSamples.js`, `demo/synth.js`, `assets/practice/` | Catálogo de discos: dos fragmentos reales de piano con licencia libre (WAV de 16 s, se descargan solo al elegirlos) y cuatro grabaciones sintetizadas en el navegador (Soul, Funk, Jazz, Voz). |
| Export / Loops / Escenas / Timeline | `exportEngine.js`, `loopEngine.js`, `projectEngine.js`, `timelineEngine.js`, `library.js`, `aiAssistant.js` | Sin cambios. Usados por `#/legacy`; volverán en el modo avanzado. |

## Modelo de datos (schemaVersion 1)

```js
Project  { schemaVersion, id, name, createdAt, updatedAt, mode: 'learning'|'free', bpm,
           samples: EditableSample[], activeSampleId, slices: Slice[], padBanks: PadBank[],
           patterns: [], drumKit: null, settings }
Slice    { id, sampleId, start, end, name, color, pitch, gain, reversed,
           triggerMode: 'oneshot', fadeInMs, fadeOutMs, keyBinding, midiNote }
PadBank  { id, name, pads: (sliceId | null)[16] }
Pattern  { id, name, kind: 'chops'|'drums', bars, bpm, quantize: 'off'|'1/4'|'1/8'|'1/16',
           events: [{ id, padId, beat, time, duration, velocity }] }
```

En `drums`, `padId` es la pieza del kit ('kick', 'snare', 'hat', 'open'). Las dos pistas duran lo mismo.
`DrumKit { id, name, pads: [{ id, gain, pitch }] }` y `settings.mix { chops, drums, master }` completan el proyecto.

Un evento de pattern guarda el **pad** y el **beat** de tu toma original: nunca audio. El quantize se aplica al
reproducir, así que «Original» siempre está disponible. Al reproducir, cada evento busca qué chop hay en su pad,
de modo que cambiar pitch o reverse se oye en la toma al instante.

El color del chop es su identidad (onda, pad y, en Fase 2, pattern). La letra es la posición del pad.

## Estado

| Store | Contenido | Persistente |
|---|---|---|
| `projectStore` | Proyecto + historial de deshacer/rehacer por snapshots (los gestos continuos se agrupan por `key`) | Sí (Fase 5) |
| `uiStore` | Pantalla, chop seleccionado, herramienta, toasts, «ocupado» | No |
| `recorderStore` | Toma pendiente (antes de «Quedármela»), compases, cuenta atrás, metrónomo | No |
| `learningStore` | Progreso (`findComplete`… `resampleComplete`), misiones saltadas y cerradas, «explorando», mensajes vistos, coach on/off | Sí (Fase 5) |

`createStore()` es el mismo patrón `useSyncExternalStore` de v0.1, sin dependencias.

## UI

| Pantalla | Componentes |
|---|---|
| Inicio | `Home` |
| Find | `SourcePicker` (cajas de discos de práctica + importar) |
| Find + Cut + Loop | `CutLab` (escuchar → «Aquí hay algo» → INICIO/FIN → Repetir → «Este es mi sample») |
| Chop + Play | `ChopLab`, `ChopTools`, `PadGrid`/`Pad`, `ChopInspector` |
| Record / Drums | `RecordLab` (pista `chops` o `drums`), `TempoControl`, `PatternLane`, `DrumPads`, `MixPanel` (+ `TransportMini` en la barra superior) |
| Beat | `BeatResult` (resumen, play, Exportar WAV) |
| Comunes | `Waveform` (+ `WaveOverview`), `MissionHead`, `StepBar`, `ProgressPanel`, `CoachLine`, `AudioGate`, `Toast` |

### Modo Aprendizaje vs Modo Libre

`project.mode` decide. En Aprendizaje, `MissionHead` sustituye la cabecera de la pantalla por la misión actual
(o por «Misión cumplida → Seguir / Quedarme»), el inspector revela las transformaciones poco a poco y el coach calla
lo que la misión ya explica. En Libre, cabeceras normales, todo visible y coach apagado por defecto.

`Waveform` tiene dos capas: *base* (se redibuja al cambiar datos o vista) y *live* (rAF con `getLive()` → playheads + chops sonando).
Los pads suenan en `pointerdown`; el teclado usa `click` (Enter/Espacio con foco) y el mapa global de teclas.

Estilos: `styles/tokens.css` (design system), `base.css`, `screens.css`, `pads.css`. Sin estilos inline salvo valores dinámicos (color de chop, anchuras).

## Rutas

`main.jsx` elige por hash y carga cada interfaz en su propio chunk: `#/legacy` → `legacy/LegacyApp.jsx`; resto → `App.jsx`. Cambiar entre ambas recarga la página para que nunca convivan sus estilos ni su estado.

## Tests

`vitest` sobre funciones puras: DSP, WAV, slices, pitch, teclado, historial, coach, pistas de corte, modelo de proyecto e importación. Lo que depende de Web Audio (sampler, síntesis de práctica) se verifica en navegador.
