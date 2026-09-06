# Ysabel Society Content Media Preview

This folder owns the preview interface, including the supplied painting, the original logo, Three.js interaction, media library and 15-position feed. It is built independently so its CSS and dependencies cannot change the restaurant website.

The website's normal `npm run build` installs this folder's locked dependencies and builds the interface into `public/contentpreview-app`. That output is generated and is not committed. `/contentpreview` opens this same-origin interface in an isolated frame; it no longer embeds the externally hosted app page.

## Existing private data

The original authenticated backend remains the source of truth for login, media, boards, notes and published feeds. The narrow `/contentpreview/api/*` rewrite in `next.config.ts` forwards requests to that backend. This change does not copy, seed, migrate or delete production data. Credentials and signing secrets remain on the existing server, never in this repository. The login scene advances only after the actual backend confirms authentication and the workspace has loaded.

The `chatgpt.site` app remains available as the earlier access point. Interface changes in this folder affect the website's `/contentpreview` page; they do not update that separate app page.

## Checks

- From this folder: `npm test` checks crop bounds, motion, pause, hidden tabs, authentication gating and failed/black WebGL frames.
- From the repository root after dependencies are installed: `node --test tests/contentpreview-route.test.mjs` checks namespaced routing, stored-media URLs and isolation from the main website.
- `npm run build` at the repository root builds both the preview and the existing website.

No changes to hosting-account settings are required by this source update.
