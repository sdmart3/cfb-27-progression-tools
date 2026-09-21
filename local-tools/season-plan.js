// Where a dynasty save sits in the season, and which save passes belong there.
//
// The Development Spread and the Regression Tool used to be two apps, and the user picked which one
// (and which of the spread's two passes) to run. Every costly mistake in testing came from that
// choice, not from the maths: the roster pass run at preseason instead of National Signing Day, a
// save taken for signing day that was already past training results, a tool run on a save renamed
// mid-season. The save already says where it is, so the combined app reads that and picks the passes
// itself.
//
// This is a fork of the parent project's tools/season-plan.js, kept local to this repo instead of
// copied at build time, because the parent version also lists a third pass (Team Overall correction)
// this project does not ship: pulling it in unmodified would leave a dead 'teamoverall' step and a
// require('./team-overall.js') this app's copy list deliberately never satisfies.
//
// SeasonInfo, as observed across every test dynasty (runs 1-6, the noise-floor copies and vanilla):
//   CurrentStage PreSeason, week 0                    first day of the year -> recruits pass
//   CurrentStage OffSeason, CurrentOffseasonStage 7   National Signing Day   -> Regression Tool, then roster pass
//   CurrentStage OffSeason, CurrentOffseasonStage 8   training results done  -> nothing; too late this season
// OffseasonNumStages is 9 in all of them. Signing day and training results are read relative to it
// (count - 2 and count - 1) rather than as fixed numbers, on the guess that a league with a different
// stage count keeps them as the last two stages before preseason. That is untested, which is why the
// app keeps a manual override.
//
// The Regression Tool runs before the roster pass because the roster pass groups players by
// development trait (the anchor is trait x position x class), so it has to see this season's trait
// changes, as it did in every test run.
//
// runSteps() then runs those passes with the app's settings. It is the only place the combined app
// calls the passes from, so the equivalence check (old apps in sequence vs this, byte-identical saves
// on run 6's season-3 signing-day backup) exercised the same code the app runs.
//
// It also reports whether the tools already hold records for this save's NAME. Both passes key their
// caches by file name, so a dynasty saved under a new name mid-career looks brand new: the ceiling
// baseline would be recorded from values the tools had already changed, and this season's skill
// point grants would be paid a second time.
//
// usage: node season-plan.js <save>     prints where the save is and what the app would run
const fs = require('fs');
const path = require('path');
const { openOptions } = require('./save-schema.js');
const baseline = require('./cap-baseline.js');
const grants = require('./trait-baseline.js');
const maddenFranchise = requireMadden();
function requireMadden() {
  try { return require('madden-franchise'); }
  catch (e) { return require('C:/dev/roster-gui/node_modules/madden-franchise'); }
}

const get = (rec, k) => { try { return rec[k]; } catch (e) { return undefined; } };
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// The passes each phase runs, in order.
const STEPS = { preseason: ['recruits'], nsd: ['regression', 'roster'] };

function openSave(file) {
  const { FranchiseFile } = maddenFranchise;
  return new Promise((resolve, reject) => {
    const f = new FranchiseFile(file, openOptions());
    f.on('ready', () => resolve(f));
    f.on('error', reject);
  });
}

// Pure: the SeasonInfo fields in, the phase out. Kept separate from the file reading so it can be
// checked against known saves without opening one.
function phaseOf(s) {
  const stage = String(s.stage ?? '');
  const count = s.offseasonStages || 9;
  const nsd = count - 2, trained = count - 1;
  const year = s.year != null ? s.year : '?';
  if (stage === 'PreSeason') {
    if (s.week === 0 || s.week == null) {
      return { phase: 'preseason', label: `${year} preseason`, detail: 'First day of the year, before anyone signs. The recruits pass runs here.' };
    }
    return { phase: 'other', label: `${year} preseason, week ${s.week}`, detail: 'Past the first day of the year. The recruits pass belongs on the first day, before anyone signs.' };
  }
  if (stage === 'OffSeason') {
    const at = s.offseasonStage;
    if (at === nsd) return { phase: 'nsd', label: `${year} National Signing Day`, detail: 'After the season, before training results. The Regression Tool and then the roster pass run here.' };
    if (at === trained) return { phase: 'afterTraining', label: `${year} offseason, after training results`, detail: 'Training results have already been applied this season, so signing-day changes would come too late. Advance to the new season for the recruits pass.' };
    if (at != null && at < nsd) return { phase: 'early', label: `${year} offseason, stage ${at} of ${count}`, detail: 'Before National Signing Day. Advance to signing day, save, and come back.' };
    return { phase: 'other', label: `${year} offseason, stage ${at ?? '?'} of ${count}`, detail: 'Not a stage these tools run at.' };
  }
  return { phase: 'other', label: `${year} ${stage || 'unknown stage'}${s.week != null ? `, week ${s.week}` : ''}`, detail: 'The season is under way. The tools run on the first day of the year and at National Signing Day.' };
}

function readStage(f) {
  const t = f.getTableByName('SeasonInfo');
  const rec = t && (t.records || []).find((r) => !r.isEmpty);
  if (!rec) return null;
  return {
    year: num(get(rec, 'CurrentSeasonYear')),
    seasonIndex: num(get(rec, 'CurrentYear')),
    stage: get(rec, 'CurrentStage') != null ? String(get(rec, 'CurrentStage')) : null,
    offseasonStage: num(get(rec, 'CurrentOffseasonStage')),
    offseasonStages: num(get(rec, 'OffseasonNumStages')),
    week: num(get(rec, 'CurrentWeek')),
  };
}

// What the tools already know about this save name.
function records(file) {
  const b = baseline.load(file);
  const readStore = (kind) => {
    const p = grants.fileFor(file, kind);
    if (!fs.existsSync(p)) return null;
    try { const j = JSON.parse(fs.readFileSync(p, 'utf8')); return { seasonKey: j.seasonKey || null, runs: j.runs || 0 }; }
    catch (e) { return null; }
  };
  return {
    baseline: b.existed ? { players: Object.keys(b.players || {}).length, runs: b.runs || 0 } : null,
    traitSnapshot: readStore('trait-snapshots'),
    spGrants: readStore('sp-grants'),
  };
}

async function inspect(file) {
  const f = await openSave(file);
  const t = f.getTableByName('SeasonInfo');
  if (t) await t.readRecords().catch(() => {});
  const s = readStage(f);
  if (!s) return { file, name: path.basename(file), phase: 'other', label: 'unknown', detail: 'This save has no SeasonInfo table; it may not be a dynasty save.', steps: [], warnings: [] };
  const p = phaseOf(s);
  const rec = records(file);
  const warnings = [];
  // A dynasty past its first season with no ceiling records under this name is either a first use of
  // the tools mid-career (fine) or a save renamed after the tools ran (not fine). Only the user knows.
  if (!rec.baseline && (s.seasonIndex || 0) > 0) {
    warnings.push({ kind: 'noRecords', text: `The tools have no records for a save named ${path.basename(file)}. If you have run them on this dynasty before under another name, stop: load that dynasty, save it under its original name, and run on that. Running here would record this dynasty's starting ceilings from values the tools already changed.` });
  }
  return { file, name: path.basename(file), ...s, ...p, steps: STEPS[p.phase] || [], records: rec, warnings };
}

// Runs the given passes on the save, in order, with the app's settings. A preview (write false) runs
// each one read-only on the save as it stands. With write, it stops at the first failure; what already
// ran stays applied (each pass backed the save up first) and is returned with the error. Required
// lazily so inspect() stays cheap.
async function runSteps(file, steps, st, { write = false, backupDir } = {}) {
  const done = [];
  const seed = Number(st.seed) || 27;
  for (const step of steps) {
    try {
      let result;
      if (step === 'regression') {
        result = await require('./regression-tool.js').run(file, {
          severity: Number(st.severity), coachWeight: Number(st.coachWeight), promote: Number(st.promote),
          turnaround: Number(st.turnaround), spGrant: Number(st.spGrant), awardSp: Number(st.awardSp),
          seed, write, backupDir,
        });
      } else {
        const shared = {
          stretch: Number(st.stretch), starWeight: Number(st.starWeight), jitter: Number(st.jitter), seed,
          write, saveBaseline: false, scope: step, backupDir,
        };
        result = step === 'roster'
          ? await require('./spread-skill-caps-env.js').run(file, { ...shared, envSwing: Number(st.envSwing), fuel: Number(st.fuel), bust: Number(st.bust) })
          : await require('./spread-skill-caps.js').run(file, { ...shared, xpJitter: 0 });
      }
      done.push({ step, result });
    } catch (e) {
      e.steps = done;
      e.failedStep = step;
      throw e;
    }
  }
  return done;
}

module.exports = { inspect, phaseOf, runSteps, STEPS };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node season-plan.js <save>'); process.exit(1); }
  inspect(file).then((r) => {
    console.log(`${r.name}: ${r.label}`);
    console.log(`  ${r.detail}`);
    console.log(`  passes: ${r.steps.length ? r.steps.join(' -> ') : 'none'}`);
    const rc = r.records || {};
    console.log(`  records: baseline ${rc.baseline ? rc.baseline.players + ' players' : 'none'}, trait snapshot ${rc.traitSnapshot ? rc.traitSnapshot.seasonKey : 'none'}, skill-point grants ${rc.spGrants ? rc.spGrants.seasonKey : 'none'}`);
    for (const w of r.warnings) console.log(`  WARNING: ${w.text}`);
  }).catch((e) => { console.error(e.message); process.exit(1); });
}
