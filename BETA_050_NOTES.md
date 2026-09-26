# Beta 0.50 — Full Online Integration / Kamikaze

Esta beta se desarrolla exclusivamente en `beta-kamikaze-0.50`. No se mergeó a `main` y no se desplegó en Cloudflare.

## Base y estructura

Se tomó `stable_game_0.47.2/` del paquete de handoff como base, por encima de la versión anterior que tenía la rama. La primera entrega quedó preservada en un commit antes de integrar cambios. El backend probado de Phase 5 se conserva sin cambios en `reference/phase5/`.

- `public/index.html`: interfaz y estilos originales.
- `public/game.js`: juego base, con los puntos de integración y correcciones de controles.
- `public/online-beta050.js`: adaptación online y presentación de estados recibidos.
- `public/bootstrap.js`: inicio y enlaces de interfaz.
- `public/assets/`: imágenes externas; no se generó un HTML gigante.
- `backend/simulation.mjs`: reglas autoritativas de la sala.
- `backend/worker.mjs`: WebSockets, Durable Object y persistencia.
- `backend/world.json`: mapa, colisiones, aparición de enemigos, NPCs y cofres extraídos de la base.
- `backend/rules.mjs`: estadísticas y generación de objetos de 0.47.2.

## Sistemas conectados

Bruno/Nala y dirección/animación; movimiento validado contra colisiones; HP/MP/Stamina; combo, ataque, dash, aullido y sus mejoras; 17 enemigos con IA en el servidor; daño, muerte y respawn; drops, XP/nivel, oro/materiales; equipo, inventario y autoequipado; NPCs, diálogos, tiendas, pociones, posada y reforja; misiones; cofres compartidos; interiores, entrada/salida de cueva; Rey Gato con segunda fase; victoria y exploración posterior.

Los clientes envían intenciones, no HP, daño ni recompensas. El servidor calcula las reglas y envía estados completos. Las transacciones de cofres, recogida y recompensas se serializan dentro del Durable Object. Los clientes no ejecutan IA ni daño de enemigos online. SOLO conserva el circuito local.

Se corrigieron dos problemas detectados por QA: faltaba `updateJoystickFromPointer` en el archivo del handoff, y una pulsación breve de F/G/H podía perderse entre frames. Ahora el joystick tiene su cálculo y las acciones de teclado se disparan en el evento de pulsación.

## Decisiones multijugador

- Cada personaje tiene inventario, equipo, oro, materiales, pociones y puntos propios.
- La XP se otorga una vez por muerte a cada compañero conectado en la misma escena y a menos de 900 unidades. Es recompensa cooperativa intencional, no doble procesamiento.
- Un drop lo recibe el primer personaje que lo recoge. Un cofre abre una sola vez y da equipo a quien lo abrió.
- Progreso y objetivos de misiones son compartidos; cada personaje puede cobrar su recompensa una sola vez, junto al NPC correspondiente.
- Metal Gatuno usa 2 metales del conjunto de jugadores al primer cobro; cada personaje recibe su mejora una vez.
- Las escenas son individuales: uno puede estar en la cueva mientras el otro está en el pueblo. El jefe y la victoria pertenecen a la sala.
- El Rey Gato no reaparece. Los enemigos normales reaparecen cuando su zona está libre.
- Morir devuelve al pueblo con el progreso y el equipo intactos.
- Inventario, diálogos y tiendas detienen tu entrada de movimiento, pero no pausan la sala ni dan inmunidad.
- NPCs online permanecen en sus posiciones fijas para que ambos vean el mismo punto de interacción. SOLO conserva su paseo.
- La mochila conserva hasta 18 objetos; al llenarse se retira un objeto antiguo no equipado. No hay comercio entre jugadores.
- Se conserva el estado de los dos roles en esa sala. Al reconectar se asigna el primer rol libre; no hay cuentas ni reserva de personaje con token.

## Protocolo y aislamiento

Se mantienen `/create`, `/ws/PAWS-XXXX` y mensajes de bienvenida/ping. El RPG completo usa protocolo 50 (`?v=50`), comandos de entrada y snapshots. Las coordenadas del mapa real no son compatibles con el pequeño escenario normalizado de Phase 5; por eso la beta usa servicios separados y exige su versión de cliente.

- Backend beta: `paws-claws-coop-beta050`.
- Juego beta: `game-pawsandclaws-beta050`.
- Servicios estables `paws-claws-coop` y `game-pawsandclaws`: no desplegados ni reemplazados por este trabajo.

## Despliegue exacto: primero backend, después juego

Desde una copia del repositorio, en PowerShell o terminal:

```sh
git switch beta-kamikaze-0.50
git pull --ff-only
cd backend
npm ci
npx wrangler login
npx wrangler deploy
cd ..
```

Antes de publicar el juego, comparar la URL que devuelve Wrangler con la constante `ONLINE_COOP_SERVER` en `public/game.js`. La configuración preparada apunta a `https://paws-claws-coop-beta050.nickuz.workers.dev`. Si la cuenta devuelve otro subdominio, cambiar esa constante por la URL real. Comprobar `/health`: debe indicar protocolo 50.

Después, desde la raíz:

```sh
npm ci
npx wrangler deploy
```

Esto publica el juego como `game-pawsandclaws-beta050`, según el `wrangler.jsonc` de esta rama. Usar la URL que devuelva el comando. No conectar esta prueba a un despliegue que fuerce el nombre del Worker estable, y no mergear a `main` para probarla.

## QA ejecutado

- `npm run check`: validación sintáctica del cliente y backend, aprobada.
- `npm test`: 10 pruebas de lógica aprobadas.
- `wrangler deploy --dry-run`: compilación local de backend y frontend aprobada, sin publicar.
- Asset individual más grande: 3.167.841 bytes, por debajo de 25 MiB.
- `tests/browser-integration.cjs`: 16 comprobaciones aprobadas con Chromium y el runtime local real de Durable Objects (Miniflare), usando dos contextos separados: escritorio y móvil táctil.
- Sin errores fatales de JavaScript durante la prueba de integración.
- Crear sala y unir segundo cliente desde los botones reales.
- Movimiento WASD y joystick; F/G/H/R/E; ATQ/DSP/MAG/ACT.
- Ataque/habilidad, HP compartido de enemigos y consumo de recursos.
- Cofre único, recogida simultánea sin oro duplicado, inventario/equipo y mejoras por jugador.
- Diálogo con NPC, misión compartida y cobro único por personaje.
- Entrada de cueva, jefe único, victoria en ambos, continuar explorando y respawn sin entrada de usuario.
- Las pruebas de lógica cubren además materiales únicos, cooldowns, XP, persistencia de equipo, salida de cueva y zona segura.
- Reporte de navegador: `docs/QA_BETA_050_BROWSER.json`.

La prueba automatizada coloca personajes y enemigos mediante fixtures en un bundle temporal de prueba, para alcanzar los escenarios sin caminar todo el mapa. Esa ruta de preparación NO existe en el Worker de producción. No equivale a una partida completa de principio a fin con balance real.

Para repetir:

```sh
npm ci
npm --prefix backend ci
npm run check
npm test
npx playwright install chromium
npm run test:browser
```

Los resultados y capturas se generan en `qa-results/`. `CHROMIUM_EXECUTABLE` permite usar otro Chromium instalado; `QA_OUTPUT` permite cambiar la carpeta de salida.

## Latencia / predicción local

Se agregó predicción local del movimiento del personaje controlado y dash predictivo en el cliente. El Worker sigue siendo autoritativo: cada snapshot conserva la posición oficial y el cliente corrige deriva de forma suave, con hard-snap únicamente ante divergencias grandes. La reconciliación respeta las colisiones locales y proyecta levemente el estado del servidor usando RTT/2 + medio tick para evitar arrastrar al jugador hacia una posición vieja mientras se mueve.

Cambios principales:

- movimiento local inmediato cada frame en PC y touch;
- input de red continúa a 20 Hz;
- snapshots autoritativos continúan aproximadamente a 10 Hz;
- reconciliación suave mientras se mueve y más rápida al quedar quieto;
- dash mostrado inmediatamente y corregido por el siguiente snapshot;
- otros jugadores siguen interpolados, no predichos;
- no se cambió daño, loot, quests, cofres, boss ni autoridad del servidor.

Pendiente de QA físico: medir sensación con ~130–140 ms de RTT, observar rubber-banding junto a paredes y comparar PC/Android en redes distintas.

## Límites conocidos y QA pendiente

- No se desplegó ni se probó esta beta en Cloudflare público. Falta PC + Android físico en redes distintas.
- La IA online es una versión básica autoritativa: persecución, regreso, ataques por rango y segunda fase/área del jefe. No reproduce todavía todos los proyectiles, telegráficos, patrullas y efectos de combate de SOLO. No debe considerarse paridad exacta de balance.
- Movimiento interpolado, sin predicción local: la latencia de Internet puede sentirse en el control. Falta medirla en redes reales.
- Se persisten/envían snapshots completos aproximadamente cada 100 ms mientras hay jugadores. Es una implementación de beta; faltan mediciones y optimización de escrituras, tráfico y coste antes de usarla muchas horas o con muchas salas.
- No hay reconexión automática, cuentas, guardado entre salas distintas ni eliminación programada de salas antiguas.
- La UI móvil conserva el diseño de la base; falta revisar tamaños, minimapa y superposición del HUD en teléfonos reales y orientación vertical.
- Compras/forja/posada están conectadas, pero no todas las combinaciones de tienda se recorrieron en el navegador automatizado.

### Checklist manual en la beta publicada

- [ ] Crear sala en PC, unirse desde Android por datos móviles.
- [ ] Recorrer valle, edificios y cueva; comprobar paredes, agua y fuente.
- [ ] Combatir varios minutos con ambos; comparar HP, XP y recursos.
- [ ] Recoger un drop/abrir un cofre simultáneamente.
- [ ] Comprar, preparar pociones, descansar, reforjar y equipar con ambos roles.
- [ ] Completar las tres misiones y repetir intentos de cobro.
- [ ] Matar al jefe, abrir el cofre final, continuar y salir de la cueva.
- [ ] Morir, reconectar cada rol y comprobar progreso.
- [ ] Revisar HUD/joystick/botones con rotación y en teléfono físico.
- [ ] Medir retraso, tráfico y uso del Worker durante una sesión prolongada.
