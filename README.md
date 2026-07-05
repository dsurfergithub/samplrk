# SAMPLRK

De cualquier sonido a un loop profesional: **Archivo → Sample editable → Loop inteligente → Capas → Canción**.

App de creación musical basada en samples. No es un DAW: es un flujo mínimo para que cualquiera construya una base musical desde un único archivo de audio. Ver [ARCHITECTURE.md](ARCHITECTURE.md) para el diseño completo.

## Comandos

```bash
npm install
npm run dev      # desarrollo (Vite)
npm test         # tests unitarios (vitest: DSP + WAV)
npm run build    # producción → dist/
```

## Estado actual (v0.1)

- ✅ Importación: WAV/MP3/FLAC/OGG/M4A, vídeo (pista de audio), micrófono y beat sintético de prueba
- ✅ Editable Sample no destructivo: trim, reverse, gain, normalize, fades, pitch, slices, zoom/selección en canvas
- ✅ Análisis en Web Worker: BPM + confianza, rejilla de beats, tonalidad (Krumhansl), transitorios, silencios, energía
- ✅ Generador de loops con Loop Validator (clics, continuidad, estabilidad) y anti-clic
- ✅ Launchpad cuantizado al compás con BPM compartido, escenas y timeline (Intro/Verse/Drop…)
- ✅ Exportación WAV de loop / sample / escena / canción (render offline)
- ✅ Asistente basado en reglas que explica el motivo de cada sugerencia
- 🗺️ Hoja de ruta: MP3/FLAC (codificadores), separación de instrumentos, persistencia de proyectos, automatizaciones por escena
