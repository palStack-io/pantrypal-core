# pantryPal Core: web UI

React + TypeScript + Vite web app for pantryPal Core, served by the nginx container.
For setup, configuration and Docker usage, see the [top-level README](../../README.md).

## Local development

```bash
npm install
npm run dev      # Vite dev server with hot reload
npm run build    # production build; must pass before shipping
```

The dev server expects the API gateway running (for example the full stack from `docker-compose.dev.yml`).
