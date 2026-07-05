# SAMPLRK — Arquitectura

> Archivo de audio → Sample editable → Loop inteligente → Capas musicales → Canción

## Principios

1. **El `EditableSample` es el núcleo.** Todo el flujo trabaja sobre este modelo. El audio original nunca se modifica: las ediciones son una lista de operaciones no destructivas que se aplican al renderizar.
2. **Módulos completamente desacoplados.** Los motores no conocen React ni el DOM (salvo `audio_engine`, que envuelve Web Audio). La UI solo llama a funciones de motor y lee el store.
3. **Nada bloquea la UI.** El análisis DSP corre en un Web Worker; la exportación usa `OfflineAudioContext`.
4. **La IA asiste, nunca sustituye.** Cada sugerencia lleva su motivo explícito y una acción opcional de un clic.

## Módulos

| Módulo | Fichero(s) | Responsabilidad |
|---|---|---|
| `sample_engine` | `src/engines/sampleEngine.js` | Modelo `EditableSample`, registro de buffers, render no destructivo de ediciones (trim, reverse, gain, normalize, fades, pitch) |
| `analysis_engine` | `src/engines/analysisEngine.js` + `analysisWorker.js` + `dsp.js` | BPM, rejilla de beats, tonalidad, transitorios, silencios, energía, forma de onda. `dsp.js` son funciones puras (testeables en Node); el worker las ejecuta fuera del hilo principal |
| `loop_engine` | `src/engines/loopEngine.js` | Generación de candidatos de loop alineados al compás, **Loop Validator** (clics, continuidad, estabilidad), snapping a cruces por cero, anti-clic, categorización (batería/bajo/melódico/ambiental/rítmico) |
| `audio_engine` | `src/engines/audioEngine.js` | AudioContext, transporte compartido (BPM, compases), scheduler cuantizado: ningún loop entra fuera del compás. Previews, mezcla por loop (vol/pan) |
| `project_engine` | `src/engines/projectEngine.js` | Escenas (solo: loops activos + volumen + pan), serialización del proyecto |
| `timeline_engine` | `src/engines/timelineEngine.js` | Secciones de canción (Intro/Verse/Drop…) sobre escenas; reproducción programada con tiempos absolutos |
| `export_engine` | `src/engines/exportEngine.js` | Render offline de loops/escenas/canción y codificación WAV (MP3/FLAC: hoja de ruta) |
| `ai_assistant` | `src/engines/aiAssistant.js` | Motor de sugerencias basado en reglas sobre el estado; siempre explica el motivo |
| `library` | `src/engines/library.js` | Biblioteca de loops: tags, energía, mood, compatibilidad entre loops (tonalidad relativa + BPM) |
| `ui` | `src/ui/*` + `src/state/store.js` | Vistas: Importar, Editor, Loops (launchpad), Escenas, Timeline, Asistente. Store observable minimalista |

## Modelo de datos

### EditableSample
```
{ id, name, source, sampleRate, channels, duration, createdAt,
  analysis: { bpm, bpmConfidence, firstBeat, timeSignature, key, mode,
              keyConfidence, transients[], silences[], energy[], peaks[] } | null,
  markers[], regions[], slices[],
  edits: { trimStart, trimEnd, gain, normalize, fadeInMs, fadeOutMs,
           reversed, pitchSemitones } }
```
Los `AudioBuffer` viven en un registro runtime (`Map id→buffer`) fuera del store para no serializar audio.

### Loop
```
{ id, name, category, color, sourceSampleId, bars, duration, bpm, key, mode,
  tags[], energy, mood, loopStart, loopEnd, peaks[], valid, score, issues[],
  pitch, compatibleWith[] }
```

### Scene → `{ id, name, color, loops: { loopId: { vol, pan } } }` (nada más, por diseño)
### Section → `{ id, name, sceneId, bars }`

## Flujo de sincronía

- Transporte único: `startTime` en tiempo de AudioContext, `barDuration = 240/bpm` (4/4).
- Activar un loop programa `source.start(nextBarTime())`; desactivar programa `stop` en el siguiente compás.
- Cada loop se renderiza con duración exacta de N compases a su BPM; al reproducirse se ajusta `playbackRate = bpmProyecto / bpmLoop`, de modo que todos los loops duran exactamente N compases del proyecto y no pierden sincronía jamás.
- La Timeline programa inicios y fines con tiempos absolutos calculados de antemano (sin drift).

## Tests

`vitest` sobre las funciones puras: DSP (BPM, tonalidad, cruces por cero, validador de loops) y codificador WAV. Los motores que dependen de Web Audio se prueban manualmente vía preview.
