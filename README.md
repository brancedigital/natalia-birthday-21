# Felices 21, Natalia 💜

Una PWA mobile-only con el itinerario sorpresa del cumpleaños: un camino animado estilo videojuego
que va revelando las sorpresas del día en orden, con pistas, un cofre de cupones de oro, pastel
sorpresa y fuegos artificiales.

**En vivo:** https://brancedigital.github.io/natalia-birthday-21/

## Cómo funciona

- **El camino:** 9 paradas que se desbloquean en orden. La personita 🚶‍♀️ camina por el sendero
  cada vez que se completa una parada, y la niebla de las zonas siguientes se va levantando.
- **Pistas:** algunas paradas piden responder una pregunta antes de revelar la sorpresa
  (el partido del Mundial, Gabo, la capital de Grecia).
- **Cupones de Oro 🎟️:** 5 masajes (pies, cuerpo, pies, cuerpo, pies) que se canjean **en orden**,
  con tiempo de espera entre uno y otro, y que **expiran el 20 de octubre de 2026** (3 meses después
  del cumpleaños). Cada canje queda sellado con fecha y hora.
- **Persistencia:** todo se guarda en `localStorage` del dispositivo. Reiniciar el camino
  **no** reinicia los cupones.

## ⚠️ Antes del día real (20 de julio)

El tiempo de espera entre cupones está en **modo prueba (1 minuto)**. En [app.js](app.js),
dentro de `CONFIG`, cambia:

```js
cooldownMs: 60 * 1000,                    // ← modo prueba
// por:
cooldownMs: 7 * 24 * 60 * 60 * 1000,      // ← 7 días reales
```

En ese mismo `CONFIG` puedes editar el nombre del restaurante colombiano y la hora del cine.
Después de cambiarlo, sube también un bump de versión en `sw.js` (`nb21-v1` → `nb21-v2`) para
que los teléfonos con la app instalada reciban la actualización.

## 🛠️ Menú secreto (para probar)

Mantén presionado el título **"Felices 21, Natalia 💜"** ~1 segundo → aparece un menú con:

- 🔄 Reiniciar camino (los cupones se conservan)
- 🗑️ Reiniciar TODO (camino + cupones)

También hay un botón de reinicio al final del camino, que solo reinicia el itinerario.

## Instalar como app en el teléfono

1. Abre la URL en el navegador del teléfono.
2. **iPhone (Safari):** Compartir → "Añadir a pantalla de inicio".
   **Android (Chrome):** menú ⋮ → "Instalar aplicación".
3. Se abre a pantalla completa, con icono propio, y funciona offline.

## Desarrollo local

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

Los iconos se regeneran con `python3 tools/make_icons.py` (solo stdlib, sin dependencias).

## Stack

HTML + CSS + JavaScript vanilla, sin frameworks ni dependencias. Sonidos sintetizados con
WebAudio (no hay archivos de audio). Service worker con cache-first para funcionar offline.
