# Paws & Claws — Playbook

## GitHub
Repository: https://github.com/Whoisnicko/game_pawsandclaws

## Cloudflare Pages
Production URL: pendiente de configurar.

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
