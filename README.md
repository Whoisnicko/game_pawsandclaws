# Paws & Claws

Repositorio oficial del juego web **Paws & Claws**.

## Estructura

- `public/index.html`: entrada pública del juego.
- `public/assets/`: sprites, imágenes, audio, fuentes y otros recursos del juego.
- `wrangler.jsonc`: configuración de Cloudflare Workers Static Assets.
- `package.json`: versión de Wrangler y comandos locales.
- `docs/GAME.md`: documentación viva del juego.
- `docs/PLAYBOOK.md`: enlaces operativos, despliegue y workflow.

## Ramas

- `main`: versión estable / producción.
- `dev`: versión de desarrollo y pruebas.

## Deploy

`main` se publicará automáticamente mediante Cloudflare Workers + Static Assets.

El proyecto no ejecuta código de Worker en servidor actualmente: Cloudflare sirve únicamente los archivos estáticos de `public/`.
