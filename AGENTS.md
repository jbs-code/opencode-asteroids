# 03-asteroids — Asteroids (Canvas HTML5)

Clon de Asteroids en canvas HTML5. Página estática sin build: `index.html` (markup + estilos embebidos) y `game.js` (todo el juego, ~420 líneas).

- No hay `package.json`, tests, linter, CI ni `.gitignore`. No ejecutes `npm install` ni añadas un bundler.
- `game.js` se carga como script clásico (`<script src="game.js">`, sin `type="module"`): sus `const`/`let` de nivel superior son globales compartidos con cualquier otro script clásico. Si lo conviertes a módulo, deja de ser global y hay que exportar explícitamente.

## Ejecutar y verificar

- Abre `index.html` en el navegador (funciona con `file://`). No hay paso de build: recargar muestra los cambios.
- Servidor estático: `python3 -m http.server 8000` → http://localhost:8000. El `npx serve .` del README necesita red para descargar el paquete y sirve en el 3000.
- Única verificación automática: `node --check game.js` (node está en el sistema, no es dependencia del proyecto). No hay tests: la validación es manual en el navegador.

## Cómo está cableado `game.js`

- Clases `Ship`, `Bullet`, `Asteroid`, `Particle`, `PowerUp`. Convención única: `update(dt)` + `draw()`; "muerto" es `entity.dead`.
- Bucle `requestAnimationFrame(loop)` → `update(dt)` → `draw()`. `dt` está acotado a 0.05 s para que no dé saltos al volver de otra pestaña.
- El estado global son variables `let` a nivel de archivo (`ship`, `bullets`, `asteroids`, `particles`, `pickups`, `score`, `lives`, `level`, `state`, `deadTimer`, `pickupCooldown`); `initGame()` los reinicia y se invoca al final del archivo.
- `W`/`H` (800/600) están duplicados en `game.js` y en `width`/`height` del `<canvas>` de `index.html`: cámbialos en los dos sitios. El canvas es un bitmap fijo, sin escalado por `devicePixelRatio` ni handler de `resize`.
- Tablas indexadas por `size` (1=pequeño, 2=mediano, 3=grande): `RADII = [0,16,30,50]`, `SPEEDS = [0,85,55,32]`, `POINTS = [0,100,50,20]`.
- El drag de la nave es independiente del framerate: `Math.pow(SHIP_DRAG, dt * 60)`. A 60 Hz equivale a multiplicar por `SHIP_DRAG`.

## Reglas de juego (fáciles de pasar por alto)

- `state` es `'playing' | 'dead' | 'gameover'`. En `gameover`, `Espacio` llama a `initGame()`.
- `pressed(code)` consume el flag de "pulsado ahora" (lo borra al leerlo): solo puede llamarse una vez por tecla y frame. Si se pulsa `Espacio` durante el estado `dead`, el flag queda pendiente y la nave dispara al reaparecer.
- El espacio es toroidal: `wrap(v, max)` teletransporta a la entidad al borde opuesto. Las colisiones, en cambio, usan distancia euclídea simple (`dist`), así que un proyectil y un asteroide visualmente pegados en bordes opuestos no colisionan. Es un bug conocido, no una regresión.
- `nextLevel()` se dispara en automático en cuanto `asteroids.length === 0`: sube `level`, limpia balas, partículas y power-ups, y hace `ship.reset()` (nave al centro con 3 s de invencibilidad). Asteroides por nivel: `3 + level`; el nivel 1 arranca con 4.
- Al morir: 2 s en estado `dead` (asteroides y partículas siguen moviéndose) y luego `ship.reset()`. 3 vidas.
- El input usa `e.code` (tecla física), no `e.key`: los controles dependen de la distribución del teclado.

## Power-up de velocidad

- `maybeDropPickup(asteroid)` lo llama la colisión bala/asteroide: 12% de probabilidad (`PICKUP_CHANCE`) y cooldown global de 8 s (`PICKUP_COOLDOWN`) para no saturar la pantalla.
- El `PowerUp` flota, tiene TTL de 14 s (`PICKUP_TTL`) y parpadea en los últimos 3 s. Se recoge con distancia euclídea simple (`dist`), igual que el resto de colisiones.
- Al recogerlo, `ship.activateBoost(5)` (`BOOST_TIME`): empuje y velocidad máxima x2 (`BOOST_MULT`) durante 5 s. La nave cambia a color cian y el HUD muestra `VELOCIDAD` con cuenta atrás y barra.
- `ship.reset()` pone `boostTimer` a 0: el boost se pierde al morir o al cambiar de nivel.

## Escudo

- `PowerUp` tiene tipo: `'boost'` (velocidad) o `'shield'` (escudo), elegido al azar en `maybeDropPickup()` desde `PICKUP_TYPES`. Comparte probabilidad (12%) y cooldown global (8 s) con el boost: el reparto es 50/50, no aumenta el total de drops.
- Al recoger un power-up de escudo, `ship.activateShield()` carga `SHIELD_CHARGES` (3) cargas. El HUD dibuja `ESCUDO` con un pip por carga.
- Con escudo activo, el impacto de la nave contra un asteroide o una estrella fugaz no la mata: consume una carga, vaporiza al asteroide (sin partirlo) y suma sus puntos.
- `ship.reset()` pone `shieldCharges` a 0: el escudo se pierde al morir o al cambiar de nivel. Si el impacto con escudo destruye al último asteroide, el nivel se completa y el escudo se reinicia con el `ship.reset()` de `nextLevel()`.

## Documentación vs código

- El README anuncia power-ups y "estrella fugaz": tanto el power-up de velocidad como el de escudo y la estrella fugaz ya existen en `game.js`.
- README y HUD en español (`NIVEL`, `PUNTAJE`, `GAME OVER`). Convención del curso: comentarios en español, identificadores en inglés.
