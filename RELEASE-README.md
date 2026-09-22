# Progression Tools for College Football 27

A desktop app that makes player development in a CFB 27 dynasty less predictable, so recruiting stars stop deciding careers on their own. It edits your save file directly — no injection, no DLL, nothing running inside the game — and only writes when you tell it to.

1. **Development Spread.** Every player's skill-group ceilings (how far he can grow) are re-rolled once a year around the average for players like him — same development trait, position and class. Recruits get this at the first day of a new season; the whole roster gets it at National Signing Day, where about 8% also draw a "bust" (their ceiling settles near their current overall) and the levels that frees up fund skill points for the players who broke out furthest above their billing. Measured over three seasons: players at 90+ overall roughly doubled, players under 65 roughly doubled, and the league average held flat.
2. **Regression Tool.** At National Signing Day, every rostered player's season is judged — his rating against players like him, his production on the field, his awards — and measured against what's typical for his position and recruiting star rating. A player well behind that billing can lose a development tier unless his program's quality catches it; one well ahead can gain one outright. Both are rewarded or, for a slide, simply held: a coached-up player earns skill points, a breakout more.

It does not touch player ratings, positions, rosters, or anything else in the save.

**Want the maths?** `docs/Method.html` in this folder is the method book: every formula, the measured results and charts behind each setting, and the assumptions, written to be read without the code. Open it in any browser.

## Install

Unzip anywhere (a folder in Documents is fine) and double-click `Progression Tools.exe`. That's it — no injection step, no antivirus exclusion to add before unzipping.

**Windows SmartScreen will probably warn on first run** ("Windows protected your PC"). This is an ordinary Electron app; it isn't flagged as a virus, it's just unsigned and not yet recognized by Microsoft. Click **More info**, then **Run anyway**. This is a one-time prompt per machine.

The app writes its backups (`Dynasty Backups`, next to the .exe) and its own records of each player's original ceilings and this season's skill-point grants (under `Documents\CFB 27 Modding\cache`) — nothing is written inside the game's own save folder except the save file itself, and only when you click Apply.

## How to run it

1. Save your dynasty at the right point, under its usual name: the first day of a new season (preseason, week 0) or National Signing Day (after the season, before training results).
2. Quit to the main menu, or close the game entirely. With the dynasty still loaded, the game will save its own copy over whatever the app writes.
3. Open Progression Tools, pick your save. The app reads where it is in the season and tells you which passes belong there — it decides this for you so a pass never runs at the wrong point in the year.
4. Preview first, then Apply.
5. Load your manual save, not an autosave.

Keep the same save name for the whole dynasty. The app's memory of each player's original ceilings and this season's grants is keyed by the save's file name; a renamed save looks brand new to it, and the app warns before applying to one.

## Settings that matter

Defaults are the tested configuration (`docs/Method.html` has the full record). Most players should leave everything alone.

| Setting | Default | What it does |
| --- | --- | --- |
| Spread | 1.6 (roster pass) / 1.8 (recruits pass) | How far a player's ceiling moves from the peer average. 1.0 = no stretch at all. |
| Star influence | 0.5 | How much of the gap between star ratings survives the spread. 0 = stars say nothing about a ceiling; 1 = the vanilla gap, unchanged. |
| Randomness | 5 (roster) / 6 (recruits) | The size, in ceiling levels, of each player's fixed personal luck draw. |
| Busts | 0.08 | Share of rostered players, at every star rating alike, whose ceiling settles near their current overall (roster pass only). 0 disables busts entirely. |
| Breakout fuel | 0.4 | Skill points handed to the biggest breakouts per ceiling level the pass cut elsewhere (roster pass only); this is a budget, not free growth, so the league average doesn't drift far. |
| Program effect | 10 | How many ceiling levels a good or bad program can add or subtract, within a development trait (roster pass only). |
| How often players slip / break out | 1.0 / 1.4 | Regression Tool severity multipliers on the slide and breakout rolls. |
| How much the coach matters | 0.60 | How strongly program quality changes a struggling player's odds of being coached up instead of sliding. |

Everything else — including the manual phase override, for a league whose season stages don't read the way the app expects — is in the app's own Settings screen and the "How it works" tab explains each one.

## Things to know before you turn it on

* **Only ceilings, traits and skill points change.** Nothing else in the save is touched.
* **Preview writes nothing.** Only "Apply to save" does.
* **Originals are remembered once, per save name.** The first ceilings the app sees for a player, under a given dynasty's save name, are his originals for good. Re-running the same season replaces that season's own changes rather than stacking on them.
* **After training results, the passes refuse to run.** The game has already spent whatever they would have granted; running again would grant it a second time. Advance to the new season instead.
* **A renamed save looks brand new.** If you've run the app on this dynasty before under a different file name, load the dynasty under its original name and run there — applying under a new name would record this dynasty's already-changed ceilings as if they were the originals. The app warns before letting this through.
* **The game must be closed to the main menu before Apply**, not sitting on a loaded dynasty. It reloads the file fresh when a dynasty is opened, but overwrites the file with its in-memory copy when a loaded dynasty is saved or the game is closed from inside one.

## What the app tells you

* The **Preview** screen shows exactly what each selected pass would change — every ceiling, trait move and skill-point grant — before anything is written.
* After Apply, the same screen shows what was actually written, and a CSV export is available for the full player-level detail.
* Warnings appear inline: game running, an autosave selected, or a save with no records under its name past its first season (the renamed-save case above).

## Known limits

* The season-stage mapping (which offseason stage is National Signing Day) is read relative to how many stages your league has, and was only ever observed on 9-stage dynasties. A manual override exists under Settings > Advanced for a league that doesn't read the way the app expects.
* The Regression Tool needs a played season to judge from; a save mid-season only holds preseason and weekly awards, not a full year's production.
* Offensive-line judging can't use QB hits or pressures (the game doesn't record them) or per-player penalties (only team totals exist).
* Windows only. Built and tested on the September 2026 game build, and re-verified unchanged against the 2026-09-22 title update.
