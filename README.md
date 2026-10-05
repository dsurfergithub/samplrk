# SAMPLRK

**Aprende a convertir cualquier sonido en música.**

SAMPLRK enseña sampling desde cero, haciéndolo: escuchas una grabación, encuentras un momento que te gusta, lo cortas, lo troceas en chops y lo tocas con pads. Sin teoría musical, sin experiencia previa, sin manual.

No es un DAW ni compite con Ableton, MPC o Koala. Es más un instrumento-juego: la app ayuda **después** de que actúes, nunca antes.

## Estado: SAMPLRK 2 · Fases 1–6 (sampler, grabación, aprendizaje, batería, guardado y MIDI)

- ✅ Discos de práctica: piano real (fragmentos con licencia libre de josefpres/Freesound, ver `src/assets/practice/CREDITS.md`) y cuatro grabaciones sintetizadas en el navegador (Soul, Funk, Jazz, Voz)
- ✅ Importar WAV/MP3 (y otros formatos si tu navegador los abre), con errores comprensibles
- ✅ Escuchar → «Aquí hay algo» → ajustar INICIO/FIN → Repetir (loop) → «Este es mi sample»
- ✅ Chop Lab: 4 / 8 cortes, detectar golpes, «yo corto»; dividir, unir, borrar, mover cortes, reordenar pads
- ✅ 8 o 16 pads con ratón, touch y teclado (`1 2 3 4 / Q W E R`)
- ✅ Flip: reordenar chops, pitch old school (cambia también la duración) y reverse por chop
- ✅ Grabar lo que tocas: cuenta atrás, 1/2/4 compases, metrónomo opcional, bucle, «¿te la quedas?»
- ✅ Tempo con ±, ×2, ÷2 y Tap; quantize opcional y no destructivo (antes / después)
- ✅ Batería (bombo, caja, charles) con teclas J K L Ñ, grabada encima de tus chops y sumando tomas; el charles cerrado corta al abierto
- ✅ «Tu primer beat»: escúchalo, mira lo que has usado y expórtalo en WAV; mezcla sencilla (sample, batería, general)
- ✅ Guardado automático en el navegador (IndexedDB): al recargar vuelves donde estabas; «Mis proyectos» para continuar, renombrar o borrar
- ✅ MIDI (Chrome): controladores de pads y teclados, velocity (también en la grabación), MIDI learn y mapa General MIDI para la batería
- ✅ Deshacer / rehacer (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z)
- ✅ Modo Aprendizaje: 11 misiones cortas (escuchar, loop, cortar, chops, tocar, flip, grabar, pitch, reverse, batería, beat), cada una en su pantalla, con «Seguir» / «Quedarme aquí y experimentar» y «Saltar»
- ✅ Sampling Basics: lista de lo practicado (sin notas de calidad) y Modo Libre sin misiones
- ✅ Coach determinista y offline: habla después de la acción y no repite lo que explica la misión
- 🔜 Fase 7 Old School · 8 avanzado

La interfaz anterior (v0.1: loops, escenas, timeline) sigue disponible en `#/legacy`.

## Navegadores

Chrome y Safari (macOS e iOS). Recomendados Chrome 110+ y Safari 16.2+. MIDI solo en Chrome; en Safari se toca con el
teclado del ordenador o la pantalla. En iPhone, quita el modo silencio para oír el audio.

## Comandos

```bash
npm install
npm run dev      # desarrollo (Vite)
npm test         # tests unitarios (vitest)
npm run build    # producción → dist/
```

Funciona 100% en el navegador: sin backend, sin cuentas, sin API externa. Tus proyectos se guardan solo en tu navegador.

## Documentación

- [SAMPLRK_2_PLAN.md](SAMPLRK_2_PLAN.md) — auditoría, decisiones y fases
- [ARCHITECTURE.md](ARCHITECTURE.md) — motores, modelo de datos, estado y UI

> Si vas a publicar música que usa grabaciones de terceros, asegúrate de tener los derechos necesarios.
