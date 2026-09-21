# Building Progression Tools from source

**This repo does not build standalone from a bare clone yet.** `build-exe.ps1` pulls two things from
outside this repo:

* the Electron runtime, from `C:\dev\roster-gui\node_modules\electron\dist`;
* `madden-franchise` and its runtime dependencies (`bit-buffer`, `fast-xml-parser`,
  `node-xml-stream-parser`), from `C:\dev\roster-gui\node_modules`;
* the two save passes and their shared helpers (`spread-skill-caps.js`, `spread-skill-caps-env.js`,
  `regression-tool.js`, `season-plan.js`, and the rest of the copy list in `build-exe.ps1`), from the
  parent project's `tools/` folder, one level up from this repo.

None of that is vendored here. If you're not on the machine this was built on, the practical option is
to **use a packaged release instead of building** — see the project's GitHub Releases.

## If you do have this workspace

1. Confirm `C:\dev\roster-gui\node_modules` has `electron` and `madden-franchise` installed.
2. From this folder: `powershell -ExecutionPolicy Bypass -File build-exe.ps1`.
3. The build fails loudly (before producing an exe) if:
   - the game is running;
   - a tool file the app requires isn't in the copy list;
   - the fixture self-test's maths invariants don't hold (see the "fixture self-test OK" line in the
     build output).
4. Output lands in `dist\Progression Tools-win32-x64\`.

## Why the tools aren't vendored into this repo

`tools/` also serves the parent project's own research and one-off scripts (100+ files), most of them
unrelated to this app. Copying just the ones this app needs into the repo at build time (rather than
committing a duplicate copy) keeps one source of truth for the maths, which is also covered by the
parent project's own testing record. If this project ever needs to be fully independent and portable,
the two passes are already independent modules — vendoring them then would be straightforward. It
isn't worth doing pre-emptively.

## `madden-franchise` is on the public npm registry

`npm view madden-franchise` resolves to `madden-franchise@4.3.6`
(https://github.com/bep713/madden-franchise), with `bit-buffer`, `fast-xml-parser` and
`node-xml-stream-parser` as its own declared dependencies — a plain `npm install madden-franchise`
would pull all four with no vendoring needed. That closes the dependency half of the portability gap;
what's left is Electron itself (a large, standard download any `npm install electron` would also
fetch) and the parent project's `tools/` folder (see above). A future release could add a real
`package.json` with `madden-franchise` and `electron` as declared dependencies instead of copying both
from `C:\dev\roster-gui`; not done yet because it hasn't been tested against a real `npm install` on
this project, and the first release ships the packaged exe regardless (see above).
