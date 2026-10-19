# CricketVerse 3D — *Experience Cricket. Control the Game.*

A browser-based 3D cricket stadium simulator: 22 animated players, a physics-driven ball, fielding AI, a tested rules engine,
interactive batting/bowling, tournaments, analytics and persistence. React 18 + TypeScript + Vite + Three.js (React Three Fiber) + Zustand + Bootstrap 5 + Recharts.
All teams/players are fictional; the 3D players are procedural low-poly meshes and sounds are synthesised — no external assets, so nothing can 404.

## Run
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 23 tests: rules engine, headless full matches, interactive modes, pause/restart, tournament
npm run typecheck
npm run build      # tsc + vite build -> dist/
npm run preview
```

## Deploy to GitHub Pages
`vite.config.ts` uses `base: './'` and the app uses `HashRouter`, so it works from any sub-path.
* Easiest: push to `main` — `.github/workflows/deploy.yml` builds and publishes (Settings → Pages → Source: *GitHub Actions*).
* Manual: `npm run deploy` (publishes `dist/` to the `gh-pages` branch via the `gh-pages` package).

## Architecture
| Folder | Responsibility |
|---|---|
| `src/game/cricketRules.ts` | Pure rules engine (no 3D, no randomness): legal balls, extras, free hits, strike rotation, wickets, innings/target/result/tie. Idempotent per delivery id. |
| `src/game/ballPhysics.ts` | Custom physics: gravity, drag, pitch/outfield bounce, spin/seam turn, rolling friction, path prediction. |
| `src/game/deliverySim.ts` | Headless simulation of one delivery: run-up → release → bounce → bat contact (timing × line × height × skills) → fielding → running → catches / run-outs / boundaries → one `DeliveryResult`. |
| `src/game/{batting,bowling,fielding,tactical}AI.ts` | Shot choice, delivery choice, interception planning, field settings, bowler selection, aggression/risk. |
| `src/game/matchEngine.ts` | Match flow (toss config, innings, over/innings breaks, dugouts, player choreography), user input API, commentary, records. |
| `src/game/simulationClock.ts` | Fixed-step clock; speed (0.5×/1×/2×) scales time only. |
| `src/scenes`, `src/components/players`, `camera` | Stadium (instanced crowd, stands, roof, floodlights, ad boards, scoreboard), 22 procedurally animated players, ball + trail, 7 cameras with smooth blending. |
| `src/store`, `src/services` | Zustand stores, LocalStorage persistence (safe on corrupt data), statistics, commentary, instant simulation. |

The same engine runs headless (tests, tournament "Simulate instantly") and live in 3D, so results are identical in kind.

## Controls
Interactive batting: **D** defend · **G** ground/drive (or **Space**) · **L** loft · **P** pull · **S** sweep · **C** cut · **F** glance · **←/→** direction · **R** run (press again to queue another) · **X** cancel run (safe early in a run) · **Esc** pause.
Interactive bowling: choose style, speed, line, length → **Space** to start run-up → **Space** again to release (accuracy depends on release timing).
Cameras: broadcast, stadium aerial, bowler, batsman, ball-follow, boundary, free (orbit/zoom/pan). Field setting can be AI-chosen or forced (attacking / balanced / defensive).

## Status — read this
**Verified (automated):** TypeScript strict check, production build, 23 unit/integration tests (rules, 12 headless 6-over matches with score consistency, determinism, no NaN positions, interactive batting & bowling driven by scripted input, pause/resume/restart/speed, practice mode, tournament league → semis → final → champion).

**NOT verified:** I had no browser in my build environment, so **nothing has been looked at or played in a real browser**. Visual correctness of the 3D scene (lighting levels at night, stadium proportions, animation poses, camera framing), frame rate, WebGL behaviour, audio, touch layout and the GitHub Pages deployment are untested. Expect to tweak visuals after first launch. LocalStorage persistence is code-reviewed and exercised only in Node (where storage is absent and the fallbacks are used).

**Known limitations / simplifications**
* Run-scoring balance: headless matches average ~6 runs/over with ~4.7 wickets per match, but runs come mostly from boundaries; singles/twos are rarer than in real cricket (AI running is conservative). Tunable in `tacticalAI.battingMood` and `deliverySim.canRun`.
* No LBW, stumpings, hit-wicket, overthrow runs, super over, powerplay fielding restrictions, or umpire models. Pad hits become leg-byes. Bowling always comes from the same end (batters walk across between overs).
* Run-out strike handling is simplified (new batter takes the dismissed batter's slot after completed-run swaps).
* After a caught dismissal runs already taken are not counted; a boundary replaces any runs already run.
* Players are low-poly procedural models; no skeletal assets or jersey numbers on shirts.
* Tournament knockout ties are decided by league position. “Simulate instantly” results are labelled as simulated.
* Bowler selection is AI-only (you choose delivery options, not who bowls). Left-arm bowlers are mirrored left-handed models.
* The main chunk is large (~1 MB three.js + ~0.4 MB charts, gzipped ~380 KB); pages are code-split.
