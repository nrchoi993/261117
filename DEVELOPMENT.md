# Project development rules

- Keep HTML, CSS, and JavaScript in separate files.
- Keep `index.html` at the project root. Put application CSS and JavaScript in `src/`; keep configuration files such as `vite.config.js` at the root.
- Connect JavaScript with ES modules and import CSS from the JavaScript entry point so Vite includes it in the build.
- Install external JavaScript libraries with `npm install` and import them; do not use CDN scripts.
- Before making code changes, inspect existing files and settings and modify only what is needed.

## Netlify deployment

- Build command: `npm run build`
- Publish directory: `dist`
