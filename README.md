# Asteroids

Clon del clásico arcade **Asteroids** implementado en canvas HTML5 puro, sin dependencias ni bundler.

## Descripción

Nave espacial en un campo de asteroides con envolvimiento de bordes (el espacio es toroidal). Destruye asteroides para sumar puntos: los grandes se parten en medianos, los medianos en pequeños. Incluye power-ups especiales y tipos de asteroides únicos como la estrella fugaz.

Los asteroides pueden soltar tres tipos de power-up:

- **Velocidad**: al recogerlo, la nave acelera el doble (empuje y velocidad máxima) durante 5 segundos.
- **Triple shot**: al recogerlo, cada disparo de la nave sale como 3 balas en abanico durante 5 segundos, con su propio indicador de cuenta atrás en el HUD.
- **Escudo**: al recogerlo, la nave queda protegida con 3 cargas. Cada impacto contra un asteroide o una estrella fugaz consume una carga, destruye el asteroide y suma sus puntos.

Los tres se pierden al morir o al cambiar de nivel.

## Tecnologías

- **HTML5 Canvas** — renderizado 2D
- **JavaScript (ES6+)** — lógica del juego en un solo archivo `game.js`
- Sin frameworks, sin bundler, sin dependencias

## Cómo correr

Abre `index.html` directamente en el navegador (doble clic), o usa un servidor local:

```bash
npx serve .
```

Luego visita `http://localhost:3000`.

## Controles

| Tecla     | Acción     |
| --------- | ---------- |
| `←` `→`   | Rotar nave |
| `↑`       | Propulsar  |
| `Espacio` | Disparar   |
| `S`       | Cambiar skin de la nave (`Shift+S` para retroceder) |

## Puntuación

| Asteroide | Puntos |
| --------- | ------ |
| Grande    | 20     |
| Mediano   | 50     |
| Pequeño   | 100    |
| Estrella fugaz | 200 |

## Características

- 3 vidas con invencibilidad temporal al reaparecer (parpadeo)
- Asteroides se parten en fragmentos más pequeños al ser destruidos
- Partículas de explosión al destruir asteroides
- Power-up de velocidad: empuje y velocidad máxima x2 durante 5 segundos, con indicador de cuenta atrás en el HUD
- Power-up de triple shot: 3 balas en abanico por disparo durante 5 segundos, con indicador de cuenta atrás en el HUD
- Power-up de escudo: 3 cargas que absorben impactos contra asteroides y estrellas fugaces, con bubble alrededor de la nave e indicador de cargas en el HUD
- Estrella fugaz: asteroide muy rápido que aparece cada 14 segundos (máximo 2 a la vez) y desaparece solo tras 12 segundos, con estela, parpadeo de aviso y cuenta atrás en el HUD. Al destruirla explota sin partirse y vale 200 puntos
- Skins de la nave: 6 siluetas (clásica, delta, dart, rombo, cruz, óvalo) con su propio color. Se cambian con `S` en cualquier momento y la elección se recuerda al recargar la página. Durante el boost la nave conserva su color: solo la llama y el halo pasan a cian
