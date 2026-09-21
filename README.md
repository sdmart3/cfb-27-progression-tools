# Progression Tools

A desktop app for College Football 27 dynasty saves. No injection, no DLL, no antivirus quarantine step: it opens your save file directly, the same way the game itself does, and only when you click Apply. It reads where your dynasty is in the season and runs whichever of its two passes belongs there:

| Pass | Runs at | What it does | Measured effect |
| --- | --- | --- | --- |
| **Development Spread** (recruits pass) | Preseason, week 0 | Re-rolls incoming recruits' skill-group ceilings around the average for players like them | Widens the ceiling spread without moving the league average (sd 12.5 → 20.3 in testing) |
| **Development Spread** (roster pass) | National Signing Day | Re-rolls every rostered player's ceilings the same way, lets ~8% bust near their current overall, and hands the biggest breakouts skill points | Players at 90+ overall and under 65 both roughly doubled over three seasons, league average held flat |
| **Regression Tool** | National Signing Day (before the roster pass) | Judges the season just played against a player's recruiting billing; a player well behind can lose a development tier unless his program catches it, one well ahead can gain one | About 50 falls a season against 100-150 rises, net tier gain cut from +128 to +71 league-wide once ranked against billing rather than raw |

Only ceilings, development traits and skill points are changed. Player ratings, positions and everything else are left exactly as the game generated them.

Full write-up, every formula and every number measured while building it: `docs/Method.html`.

## Install

See [RELEASE-README.md](RELEASE-README.md) if you downloaded a release zip — that's the file that ships with it.

## Building from source

See [BUILDING.md](BUILDING.md). Short version: this repo is source only; building the exe currently requires the same machine/workspace this was built on (a `C:\dev\roster-gui` checkout for Electron and `madden-franchise`). Get the packaged app from a release instead unless you're changing the code.

## Files

* `src/main.js`, `src/index.html`, `src/preload.js` — the Electron app.
* `build-exe.ps1` — assembles the standalone Windows build into `dist/`, copying in the save-pass logic from the parent project's `tools/` folder and running a fixture self-test against the packaged output before calling the build done.
* `docs/Method.html` — the method book: every formula, the measured results and the assumptions, written to be read without the code.

## What this replaces

The Development Spread and the Regression Tool started as two separate internal prototypes. Testing showed every costly mistake came from a person picking the wrong tool, the wrong pass, or the wrong moment — not from the maths. This app reads the save's own season stage (`SeasonInfo`) and decides that itself, with an on/off switch for each tool.

## Safety

* The game must be **closed to the main menu** (dynasty not loaded) before Apply writes anything. The game holds its own copy of a loaded dynasty in memory and saves over any external edit when you back out, which cost a season of testing once. The app warns if it sees the game running; it cannot tell a loaded dynasty from the main menu, so the warning is a reminder, not a guarantee.
* Every pass backs your save up before it writes, into a `Dynasty Backups` folder next to the app.
* Preview changes nothing. Only "Apply to save" writes.
* Re-running the same season replaces its own last run rather than stacking on it; after training results the passes refuse to run at all, because the game has already spent what they would grant.

## Status

Private for now. The maths and in-game validation are done (six full test seasons; every formula and result is in `docs/Method.html`); this repo is a clean, self-tested build of that work.
