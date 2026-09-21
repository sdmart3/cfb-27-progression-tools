# build-exe.ps1 -- assembles a standalone, double-clickable Windows build of Progression Tools (the
# Development Spread and the Regression Tool in one app) into .\dist\Progression Tools-win32-x64\,
# using the Electron runtime already unpacked under C:\dev\roster-gui\node_modules\electron\dist. Same
# approach as the roster tool's own build script: copy the runtime directly rather than running
# electron-packager.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$outDir = Join-Path $root 'dist\Progression Tools-win32-x64'
$electron = 'C:\dev\roster-gui\node_modules\electron\dist'
$mfSrc = 'C:\dev\roster-gui\node_modules'
$toolsSrc = Join-Path $root '..\tools'

if (-not (Test-Path $electron)) { throw "Electron runtime not found at $electron" }

# A running copy locks its own .exe, and the build would fail halfway with the backups set aside.
# Stop before touching anything instead.
if (Get-Process -Name 'Progression Tools' -ErrorAction SilentlyContinue) {
  throw "Progression Tools is running. Close it and build again."
}

# The build wipes the output folder, but the app keeps the user's save backups in there. Set them
# aside first and put them back afterwards, so rebuilding never destroys a backup. A stash left by a
# build that failed partway still holds backups, so it is merged into, never cleared.
$backups = Join-Path $outDir 'Dynasty Backups'
$stash = Join-Path $root 'dist\.backup-stash'
if (Test-Path $stash) { Write-Host "Found backups set aside by an earlier build; keeping them." }
if (Test-Path $backups) {
  Write-Host "Preserving existing Dynasty Backups..."
  New-Item -ItemType Directory -Force -Path $stash | Out-Null
  robocopy $backups $stash /E /MOVE /NFL /NDL /NJH /NJS /NC /NS | Out-Null
}

Write-Host "Cleaning previous build..."
Remove-Item -Recurse -Force $outDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Write-Host "Copying Electron runtime..."
robocopy $electron $outDir /E /NFL /NDL /NJH /NJS /NC /NS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed copying Electron runtime (exit $LASTEXITCODE)" }
Rename-Item -Path (Join-Path $outDir 'electron.exe') -NewName 'Progression Tools.exe'

$app = Join-Path $outDir 'resources\app'
New-Item -ItemType Directory -Force -Path $app | Out-Null
robocopy (Join-Path $root 'src') "$app\src" /E /NFL /NDL /NJH /NJS /NC /NS | Out-Null
Copy-Item (Join-Path $root 'package.json') (Join-Path $app 'package.json') -Force

# The two save passes, the season reader that picks between them, and what they require, copied in so
# the app carries its own logic. Deliberately NOT team-overall.js -- this build is the two-tool project
# (Development Spread + Regression Tool) without the Team Overall correction pass.
Write-Host "Copying save tools..."
$toolsOut = Join-Path $app 'src\tools'
New-Item -ItemType Directory -Force -Path $toolsOut | Out-Null
foreach ($f in @('spread-skill-caps.js','spread-skill-caps-env.js','regression-tool.js','season-plan.js','cap-baseline.js','trait-baseline.js','season-info.js','save-players.js','cap-anchor.js','save-backup.js','save-schema.js','season-performance.js','player-awards.js')) {
  Copy-Item (Join-Path $toolsSrc $f) (Join-Path $toolsOut $f) -Force
}

# The newer table schema. Without it the Coach table has no schema at all and every coach field
# reads back null, which silently zeroed coach level and prestige in the program score.
Write-Host "Copying schema..."
$schemaOut = Join-Path $toolsOut 'schemas'
New-Item -ItemType Directory -Force -Path $schemaOut | Out-Null
Copy-Item (Join-Path $toolsSrc 'schemas\C27_486_6.gz') (Join-Path $schemaOut 'C27_486_6.gz') -Force

# madden-franchise and its runtime dependencies only.
Write-Host "Copying madden-franchise..."
$depsOut = Join-Path $app 'node_modules'
New-Item -ItemType Directory -Force -Path $depsOut | Out-Null
foreach ($dep in @('madden-franchise','bit-buffer','fast-xml-parser','node-xml-stream-parser')) {
  $src = Join-Path $mfSrc $dep
  if (Test-Path $src) { robocopy $src (Join-Path $depsOut $dep) /E /NFL /NDL /NJH /NJS /NC /NS | Out-Null }
  else { Write-Warning "dependency not found: $dep" }
}

$readme = @"
PROGRESSION TOOLS
=================
(Development Spread + Regression Tool)

Makes player development in a CFB 27 dynasty less predictable, so recruiting stars stop deciding
careers on their own:
  - Development Spread re-rolls how much room each player has left to grow (his skill-group
    ceilings), lets a share of players at every star rating stall as busts, and hands the
    biggest breakouts skill points to spend.
  - Regression Tool re-judges development traits each season: a player well behind his billing
    can lose a tier unless his program catches it, and one well ahead can gain one.
Only ceilings, development traits and skill points are changed. Ratings, positions and everything
else are left exactly as they were.

HOW TO RUN
  Double-click "Progression Tools.exe". A normal desktop app - no browser, no install.
  Pick your save. The app reads where it is in the season and runs what belongs there:
    First day of the year (preseason, week 0)   Development Spread recruits pass
    National Signing Day (before training       Regression Tool, then the Development Spread
    results)                                    roster pass, in that order
    Anything else                               nothing; the app says where the save is
  Each tool has an on/off switch. Settings > Advanced lets you choose the passes yourself, for a
  league whose stages don't read the way the app expects.

EACH TIME
  1. Save at the right point under your dynasty's usual name.
  2. Quit to the main menu (or close the game). With the dynasty loaded, the game saves its own
     copy over the changes.
  3. Preview, then Apply.
  4. Load your manual save, not the autosave.
  Keep the same save name all dynasty: the app's records of each player's original ceiling and
  this season's skill-point grants are kept under the save's name.

SAFETY
  - Preview changes nothing. Only "Apply to save" writes.
  - Your save is backed up before each pass writes, into a "Dynasty Backups" folder next to this
    .exe. Move or copy this folder anywhere and the backups follow it.
  - Re-running in the same season replaces the last run rather than stacking on it. After
    training results the passes refuse to run, because the game has already spent the points.
  - The records live in Documents\CFB 27 Modding\cache.

The "How it works" tab in the app explains every setting.

The .exe is unsigned, so Windows SmartScreen may warn on first run - More info -> Run anyway.
"@
Set-Content -Path (Join-Path $outDir 'README.txt') -Value $readme -Encoding UTF8

if (Test-Path $stash) {
  robocopy $stash $backups /E /MOVE /NFL /NDL /NJH /NJS /NC /NS | Out-Null
  if (-not (Get-ChildItem $stash -Recurse -File)) { Remove-Item -Recurse -Force $stash -ErrorAction SilentlyContinue }
  else { Write-Warning "Some backups could not be moved back; they are still in $stash" }
  Write-Host "Restored Dynasty Backups."
}

# Smoke test: load EVERY file the copy list above just copied, exactly the way the packaged app will,
# so a tool file missing from that list fails the BUILD instead of shipping an app that opens an error
# box the first time a user hits that code path.
Write-Host "Verifying packaged requires..."
$probe = Join-Path $env:TEMP ("pt-probe-" + [guid]::NewGuid().ToString("N") + ".js")
# Single-quoted here-string: the probe script's own JS template literals (${...}) must not be touched
# by PowerShell's string interpolation, which double-quoted here-strings would attempt.
Set-Content -Path $probe -Encoding UTF8 -Value @'
const path = require('path');
const assert = require('assert');
const root = process.argv[2];
const toolsDir = path.join(root, 'resources', 'app', 'src', 'tools');
const req = (f) => require(path.join(toolsDir, f));

for (const f of ['spread-skill-caps.js', 'spread-skill-caps-env.js', 'regression-tool.js', 'season-plan.js',
    'cap-baseline.js', 'trait-baseline.js', 'season-info.js', 'save-players.js', 'cap-anchor.js',
    'save-backup.js', 'save-schema.js', 'season-performance.js', 'player-awards.js']) {
  req(f);
}
console.log('requires OK');

// Fixture self-test: pure-maths invariants for the Development Spread's shared maths in cap-anchor.js,
// so a refactor or a packaging change that breaks the maths fails the build instead of shipping
// silently. These check properties the code's own comments and design-decisions.md promise, not one
// hand-picked golden number, so they don't need updating when a default changes.
const capAnchor = req('cap-anchor.js');

// allocate() must always total exactly `want` when it fits the groups' capacity (design-decisions.md
// section 2 item 4: overflow used to be silently discarded).
{
  const out = capAnchor.allocate(72, [3, 5, 1, 2, 4, 0], 20);
  assert.strictEqual(out.length, 6);
  assert.strictEqual(out.reduce((a, b) => a + b, 0), 72, 'allocate must total exactly `want`');
  assert.ok(out.every((v) => v >= 0 && v <= 20), 'allocate must respect the per-group cap');
}

// spillCeiling() must preserve a peer group's total exactly and never breach the ceiling (section 2
// item 5: the excess used to be thrown away instead of handed to group-mates with room).
{
  const players = [
    { dev: 'Star', pos: 'QB', year: 2, raw: 130 },
    { dev: 'Star', pos: 'QB', year: 2, raw: 90 },
    { dev: 'Star', pos: 'QB', year: 2, raw: 100 },
  ];
  const before = players.reduce((a, p) => a + p.raw, 0);
  capAnchor.spillCeiling(players, 120);
  const after = players.reduce((a, p) => a + p.raw, 0);
  assert.ok(Math.abs(before - after) < 1e-6, 'spillCeiling must preserve the cell total');
  assert.ok(players.every((p) => p.raw <= 120 + 1e-9), 'spillCeiling must not breach the ceiling');
}

// recentre() must hold a cell's mean exactly where it started (section 2 item 2: shrinkage used to
// inflate the league by 1.3 levels before this was added).
{
  const players = [
    { dev: 'Normal', pos: 'WR', year: 1, total: 80, raw: 95 },
    { dev: 'Normal', pos: 'WR', year: 1, total: 60, raw: 68 },
  ];
  const wantMean = players.reduce((a, p) => a + p.total, 0) / players.length;
  capAnchor.recentre(players);
  const gotMean = players.reduce((a, p) => a + p.raw, 0) / players.length;
  assert.ok(Math.abs(wantMean - gotMean) < 1e-9, 'recentre must hold the cell mean exactly');
}

// playerLuck/playerRoll must be deterministic for the same identity, seed and salt -- the whole point
// of section 2 item 12 (luck used to re-roll every season because it came from table order instead).
{
  const a = capAnchor.playerLuck('p1|1999-01-01|QB', 27);
  const b = capAnchor.playerLuck('p1|1999-01-01|QB', 27);
  assert.strictEqual(a, b, 'playerLuck must be deterministic for the same key and seed');
  const c = capAnchor.playerRoll('p1|1999-01-01|QB', 27, 'bust');
  const d = capAnchor.playerRoll('p1|1999-01-01|QB', 27, 'bust');
  assert.strictEqual(c, d, 'playerRoll must be deterministic for the same key, seed and salt');
}

// stretchTarget(p, 1, 1) collapses to p.total exactly, whatever the data: target = anchor + 1*own +
// 1*(total - anchor - own) = total. If a formula change ever breaks that identity, re-running the pass
// at those settings would stop reproducing a player's starting ceiling.
{
  const players = [
    { dev: 'Star', pos: 'HB', year: 2, total: 85, stars: 4 },
    { dev: 'Star', pos: 'HB', year: 2, total: 70, stars: 2 },
    { dev: 'Star', pos: 'HB', year: 2, total: 60, stars: 1 },
    { dev: 'Star', pos: 'HB', year: 2, total: 95, stars: 5 },
  ];
  const anchorOf = capAnchor.anchors(players);
  const targetOf = capAnchor.stretchTarget(players, anchorOf);
  for (const p of players) {
    const t = targetOf(p, 1, 1);
    assert.ok(Math.abs(t - p.total) < 1e-6, 'stretchTarget(1,1) must return the original total');
  }
}

console.log('fixture self-test OK');
'@
# Run with Node, not the app's own exe: the exe is a Windows GUI program, prints nothing to the
# console, and so could never report a failure. The check must also SEE the success line; an empty
# result is a failure, not a pass.
$out = (& node $probe $outDir 2>&1 | Out-String)
Remove-Item $probe -ErrorAction SilentlyContinue
if ($out -notmatch 'requires OK') { throw "packaged app failed to load its tools:`n$out" }
if ($out -notmatch 'fixture self-test OK') { throw "packaged app failed its fixture self-test:`n$out" }
Write-Host "  requires OK"
Write-Host "  fixture self-test OK"

Write-Host "Done -> $outDir"
