# Kelly — Mental Math Drill

Zetamac-style timed practice for the **Kelly Criterion** (gambling and investment forms). Single-page web app, vanilla JS, no build step. Installable as a PWA on iOS/Android home screen.

## Formulas drilled

- **Gambling Kelly**: `f* = p − (1−p)/b` &nbsp; (b = net odds, p = win probability)
- **Investment Kelly (partial loss)**: `f* = p/L − (1−p)/G` &nbsp; (G = fractional gain on win, L = fractional loss on loss)

Answers are entered as a percent integer (type `40` for 40%).

## Run locally

Open `index.html` directly in a browser. No server, no install.

> Note: service worker registration requires `http(s)://`, not `file://`. Without a server, everything else still works — only offline caching is skipped. To test the PWA locally, run any static server, e.g.:
>
> ```
> python -m http.server 8000
> ```
>
> Then open `http://localhost:8000/`.

Tests: open `kelly.test.html` in a browser to verify the formula and generator pools.

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Repo → **Settings** → **Pages** → **Source: Deploy from a branch** → branch `main`, folder `/ (root)`. Save.
3. Wait ~30 seconds. Site is live at `https://<username>.github.io/kelly_game/`.

Updates: `git push` → live within seconds. No CI, no build pipeline.

## Install on iPhone (PWA)

1. Open the GitHub Pages URL in **Safari** (not Chrome — only Safari can install PWAs on iOS).
2. Tap the **Share** button.
3. Tap **Add to Home Screen**.
4. Launch from the home-screen icon. It runs full-screen, no browser chrome, works offline after first load.

On Android, Chrome will offer "Add to Home Screen" automatically; same effect.

## Files

| File | Purpose |
|---|---|
| `index.html` | UI shell (settings / game / results, all in one DOM, toggled by class) |
| `app.js` | Game loop, timer, state, localStorage, SW registration |
| `kelly.js` | Pure formula evaluators + problem generators (testable in isolation) |
| `style.css` | Mobile-first dark theme, big numerals, large tap targets |
| `kelly.test.html` | Browser-based sanity tests (open it, see pass/fail) |
| `manifest.webmanifest` | PWA metadata |
| `service-worker.js` | Cache-first offline support |
| `icons/` | App icon (SVG + 180/192/512 PNG) |

## Difficulty

- **Easy** — only emits problems whose Kelly fraction is a whole percent. Exact match required to advance (Zetamac-style auto-advance: keep typing until you hit it).
- **Hard** — realistic parameters; ±1 percentage point tolerance.

Settings, last-5 scores, and best-ever per config are persisted in `localStorage`.

## Future scope

- Poker probabilities mode: implied odds, reverse implied odds, equity, hand probability, pot odds. Plug new generators into `kelly.js` (or a sibling `poker.js`) and add a mode option in the segmented control.
- Per-problem timing analytics for weakness detection.
