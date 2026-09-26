# Paws & Claws Coop Worker — Online Phase 5

Actualiza el MISMO Worker `paws-claws-coop` ya usado en las fases anteriores.

## Esta fase agrega
- 4 enemigos compartidos: warrior, archer, mage y elite.
- HP/respawn autoritativos por enemigo.
- Drops compartidos y de consumo único: monedas, hierba o metal.
- Auto-pickup validado por distancia en el servidor.
- XP, nivel y oro/materiales por jugador.
- Skill sincronizada con cooldown autoritativo:
  - Bruno: Guardian Howl, 34 daño AoE.
  - Nala: Tracker Burst, 27 daño AoE.
- El servidor sigue validando rango, cooldowns, daño, muerte y respawn.

## Deploy
```powershell
npm.cmd install
npm.cmd run check
npm.cmd run deploy
```

Después verificá:
`https://paws-claws-coop.nickuz.workers.dev/health`

Debe indicar `version: phase5-progression` y `multiEnemy/drops/xp/skills: true`.

## Test rápido del Worker
Abrí `https://paws-claws-coop.nickuz.workers.dev/` en dos dispositivos, creá/unite a la misma sala y probá ATQ/SKILL.
