# 03-asteroids — Asteroids (Canvas HTML5)

Clon de Asteroids en canvas HTML5. Página estática sin build: `index.html` (markup + estilos embebidos) y `game.js` (todo el juego, ~420 líneas).

- No hay `package.json`, tests, linter, CI ni `.gitignore`. No ejecutes `npm install` ni añadas un bundler.
- `game.js` se carga como script clásico (`<script src="game.js">`, sin `type="module"`): sus `const`/`let` de nivel superior son globales compartidos con cualquier otro script clásico. Si lo conviertes a módulo, deja de ser global y hay que exportar explícitamente.

## Ejecutar y verificar

- Abre `index.html` en el navegador (funciona con `file://`). No hay paso de build: recargar muestra los cambios.
- Servidor estático: `python3 -m http.server 8000` → http://localhost:8000. El `npx serve .` del README necesita red para descargar el paquete y sirve en el 3000.
- Única verificación automática: `node --check game.js` (node está en el sistema, no es dependencia del proyecto). No hay tests: la validación es manual en el navegador.

## Cómo está cableado `game.js`

- Clases `Ship`, `Bullet`, `Asteroid`, `Particle`, `PowerUp`, `Skin`. Convención única: `update(dt)` + `draw()`; "muerto" es `entity.dead`.
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
- Al recogerlo, `ship.activateBoost(5)` (`BOOST_TIME`): empuje y velocidad máxima x2 (`BOOST_MULT`) durante 5 s. La llama y el halo del casco pasan a cian (`BOOST_COLOR`) y el HUD muestra `VELOCIDAD` con cuenta atrás y barra; el color de la skin se mantiene.
- `ship.reset()` pone `boostTimer` a 0: el boost se pierde al morir o al cambiar de nivel.

## Skins de la nave

- `SKINS` es un array de instancias de `Skin`. Cada una define `points` (silueta en espacio local, +X hacia la nariz), `nose` (distancia del centro al morro: de ahí salen las balas), `tail` (donde arranca la llama) y `color`/`flame`.
- `Ship.draw()` ya no dibuja un triángulo cableado: solo aplica `translate`/`rotate` y delega en `skin.draw(ctx, { thrusting, boosting })`. La silueta vive en `Skin.trace(ctx)`, que también usan los iconos de vida del HUD (`drawLifeIcon`, escalados 0.45).
- La skin actual son las globales `skin` y `skinIndex` (`let` a nivel de archivo, fuera de la sección "Estado del juego"). **No** las reinicia `initGame()`: la elección sobrevive a la reinicio de partida.
- `S` cicla a la siguiente skin y `Shift+S` a la anterior. El chequeo está al principio de `update()`, antes de las ramas por estado, para que funcione también en `dead` y `gameover`.
- Ojo: el modificador `Shift` se lee con `keys['ShiftLeft']` (estado mantenido), **no** con `pressed('ShiftLeft')` — `pressed()` consume el flag y lo borraría en el frame en que se pulsó Shift, así que `Shift+S` nunca se detectaría.
- Persistencia en `localStorage` bajo `'asteroids.skin'` (el `id` de la skin), envuelta en `try/catch` porque puede no estar disponible (`file://`, modo privado). `loadSkin()` se llama al final del archivo, antes de `initGame()`.
- El boost **no** cambia el color de la nave: el casco conserva el color de su skin y lo único que pasa a cian (`BOOST_COLOR`) son la llama y el halo (`shadowBlur`) alrededor del casco.
- `ship.radius = 12` no depende de la skin: las colisiones son idénticas para todas las siluetas.

## Documentación vs código

- El README anuncia power-ups y "estrella fugaz": el power-up de velocidad ya existe en `game.js`; el resto sigue siendo trabajo pendiente, no algo a "arreglar".
- README y HUD en español (`NIVEL`, `PUNTAJE`, `GAME OVER`). Convención del curso: comentarios en español, identificadores en inglés.
