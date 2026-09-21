// Progression Tools - Electron main process. The Development Spread and the Regression Tool in one
// desktop window; no local server, no browser.
//
// The user no longer picks a tool or a pass. season-plan.js reads where the save is in the season and
// names the passes that belong there, in order: the recruits pass on the first day of the year; the
// Regression Tool and then the roster pass at National Signing Day. Each tool has an on/off switch,
// and a manual override exists for a league whose stages do not read the way the test dynasties did.
// The plan is re-read here on every run rather than trusted from the window, so a stale screen cannot
// run a signing-day pass on a save that has since moved on.
//
// The passes are the project's own save tools, run in this process through season-plan.js runSteps():
// plain Node (madden-franchise + fs), so nothing needs a child process or an HTTP layer. They load from
// src/tools in a packaged build and from the project's tools/ folder when run from source. Backups go to a
// Dynasty Backups folder beside the running .exe, resolved fresh on every run so moving the app folder
// needs no reconfiguring.
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

function loadTool(name) {
  try { return require('./tools/' + name); }
  catch (e) { return require('../../tools/' + name); }
}
const plan = loadTool('season-plan.js');   // loads the three passes itself, from the same folder
const detail = loadTool('save-players.js');

const SAVES_DIR = path.join(os.homedir(), 'Documents', 'EA SPORTS College Football 27', 'saves');
const GAME_EXE = 'CollegeFB27.exe';

function backupDir() {
  const base = app.isPackaged ? path.dirname(process.execPath) : app.getAppPath();
  return path.join(base, 'Dynasty Backups');
}

// Whether the game is running at all. It cannot tell a loaded dynasty from the main menu, so it only
// ever warns: the edits are lost if the dynasty is loaded, because the game saves its own copy over
// them (this wiped a season of testing once).
function gameRunning() {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FI', `IMAGENAME eq ${GAME_EXE}`, '/NH'], { windowsHide: true }, (err, out) => {
      resolve(!err && String(out).toLowerCase().includes(GAME_EXE.toLowerCase()));
    });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 980, height: 900, minWidth: 720, minHeight: 600,
    title: 'Progression Tools',
    backgroundColor: '#f4f6f2',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('list-saves', () => {
  try {
    const files = fs.readdirSync(SAVES_DIR, { withFileTypes: true })
      .filter((e) => e.isFile() && /^DYNASTY-/i.test(e.name) && !/\.(bak|lock|tmp)/i.test(e.name))
      .map((e) => {
        const full = path.join(SAVES_DIR, e.name);
        let modified = 0;
        try { modified = fs.statSync(full).mtimeMs; } catch (err) { /* unreadable: sorts last */ }
        return { name: e.name, path: full, modified, autosave: /-AUTOSAVE$/i.test(e.name) };
      })
      .sort((a, b) => b.modified - a.modified);   // most recently played first
    return { savesDir: SAVES_DIR, files };
  } catch (e) { return { savesDir: SAVES_DIR, files: [], error: e.message }; }
});

ipcMain.handle('browse-save', async () => {
  const r = await dialog.showOpenDialog({ title: 'Choose a dynasty save', defaultPath: SAVES_DIR, properties: ['openFile'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('inspect-save', async (_evt, save) => {
  try {
    const [info, running] = await Promise.all([plan.inspect(save), gameRunning()]);
    return { ok: true, info, gameRunning: running };
  } catch (e) { return { ok: false, error: e.message }; }
});

// Runs the passes for the save's phase, in order. A preview runs each one read-only on the save as it
// stands. An apply stops at the first failure and reports what was already written; every pass backs
// the save up before writing, and a re-run inside the same season replaces rather than stacks.
ipcMain.handle('run-plan', async (_evt, opts) => {
  try {
    const info = await plan.inspect(opts.save);
    const phase = opts.phaseOverride || info.phase;
    const steps = (plan.STEPS[phase] || []).filter((s) => (
      s === 'regression' ? opts.parts.regression : opts.parts.spread
    ));
    if (!steps.length) throw new Error(`Nothing to run: ${info.label}. ${info.detail}`);
    if (opts.write && info.warnings.some((w) => w.kind === 'noRecords') && !opts.confirmNoRecords) {
      throw new Error('The tools have no records for this save name. Tick the box confirming this dynasty has never been run through them, or run on the save under its original name.');
    }
    const done = await plan.runSteps(opts.save, steps, opts.settings, { write: !!opts.write, backupDir: backupDir() });
    return { ok: true, phase, label: info.label, steps: done };
  } catch (e) {
    return { ok: false, error: e.message, steps: e.steps || [] };
  }
});

ipcMain.handle('confirm-apply', async (_evt, text) => {
  const r = await dialog.showMessageBox({
    type: 'warning', buttons: ['Apply to save', 'Cancel'], defaultId: 1, cancelId: 1,
    title: 'Write to your dynasty?', message: 'This writes to your dynasty save.', detail: text,
  });
  return r.response === 0;
});

ipcMain.handle('show-backup', (_evt, p) => { if (p) shell.showItemInFolder(p); });

const RT_HEAD = ['Player', 'Position', 'Year', 'Team', 'Overall', 'Expected', 'Gap', 'Percentile', 'Production %', 'Snaps/game', 'Awards', 'Top award', 'Was', 'Now', 'Outcome', 'Skill points granted'];
function regressionCsv(rows) {
  const esc = (v) => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const body = rows.map((x) => [x.name, x.pos, x.year, x.team, x.ovr, x.expected, x.gap, x.pct, x.perfRank, x.snapsPerGame, x.awards, x.topAward, x.before, x.after, x.outcome, x.sp].map(esc).join(','));
  return [RT_HEAD.join(','), ...body].join('\r\n');
}
ipcMain.handle('export-csv', async (_evt, { kind, rows, saveName }) => {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const what = kind === 'regression' ? 'trait-changes' : 'ceilings';
    const r = await dialog.showSaveDialog({
      title: 'Export the full list',
      defaultPath: path.join(app.getPath('documents'), `${saveName || 'dynasty'}-${what}-${stamp}.csv`),
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (r.canceled || !r.filePath) return { ok: true, canceled: true };
    const csv = kind === 'regression' ? regressionCsv(rows) : detail.toCsv(rows);
    fs.writeFileSync(r.filePath, csv, 'utf8');
    shell.showItemInFolder(r.filePath);
    return { ok: true, file: r.filePath, rows: rows.length };
  } catch (e) { return { ok: false, error: e.message }; }
});
