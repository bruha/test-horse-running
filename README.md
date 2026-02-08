# Horse Racing Trial Day (Nuxt 4)

Local frontend-only horse racing game implemented with Nuxt 4.

## Codebase Notes

- Core game logic and state management are implemented in TypeScript.
- Domain constants are centralized to minimize magic values and simplify future changes.

## Requirement Decisions Applied

- Horse count is fixed at **20**.
- Horse names are unique; each horse gets a unique color from a predefined 20-color palette.
- Condition score (1-100) directly affects speed throughout every race tick.
- Pause means immediate pause/resume for the currently active race.
- Mobile responsive layout is included.
- `Program` shows scheduled rounds and participants.
- `Results` shows completed rounds in finish order.

## Mechanics

- 6 rounds with required distances: 1200, 1400, 1600, 1800, 2000, 2200 meters.
- Each round picks 10 random horses from the available 20.
- Rounds run sequentially with visible movement on the track.
- Results are appended as each round finishes.

## Scripts

```bash
npm run dev
npm run build
npm run build:github-pages
npm run lint
npm run lint:fix
npm run format:check
npm run format
npm run test:unit
npm run test:e2e
```

## Deploy To GitHub Pages

This repository is configured to deploy from GitHub Actions to GitHub Pages.

1. In GitHub repository settings, open **Pages**.
2. Set **Build and deployment** source to **GitHub Actions**.
3. Push to `main` (or run the workflow manually from the Actions tab).

The workflow is defined in:

- `.github/workflows/deploy-gh-pages.yml`

It builds Nuxt using the `github_pages` preset and publishes `.output/public`.
For this repository (`bruha/test-horse-running`), the base URL is set to:

- `/test-horse-running/`

Expected production URL:

- `https://bruha.github.io/test-horse-running/`

## Testing

- Unit tests cover engine invariants and scheduling logic.
- E2E test validates generate/start/pause/resume/result flow.

## Automation Hooks

The game exposes:

- `window.render_game_to_text()`
- `window.advanceTime(ms)`

for deterministic external automation.
