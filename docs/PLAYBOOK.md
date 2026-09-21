# Paws & Claws — Playbook

## GitHub
Repository: https://github.com/Whoisnicko/game_pawsandclaws

## Cloudflare Workers
Deployment model: Workers + Static Assets  
Production URL: pendiente de configurar.

## Cloudflare build settings
- Production branch: `main`
- Build command: vacío
- Deploy command: `npx wrangler deploy`
- Non-production builds: activados
- Static assets directory: `./public`
- Worker server code: ninguno actualmente

## Branch workflow
- `main`: producción estable.
- `dev`: integración y pruebas.
- Features: ramas temporales cuando un cambio lo justifique.

## Flujo recomendado
1. Desarrollar y probar cambios.
2. Subir cambios a `dev`.
3. Verificar el preview de Cloudflare.
4. Validar funcionalidad.
5. Integrar en `main`.
6. Cloudflare publica automáticamente producción.

## Testing
Playwright se integrará después de validar el deploy base.

## Costos
Mientras el juego se sirva únicamente mediante Static Assets y no invoque código de Worker, el hosting de las solicitudes estáticas se mantiene dentro del esquema gratuito de Cloudflare.
