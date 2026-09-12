# Bundled damage engine

Source: https://github.com/smogon/damage-calc

Exact revision: `upstream.json`. License: `LICENSE-smogon` (MIT).

`calc.js` is an esbuild ESM bundle of the upstream calculation modules and data. Game mechanics are unmodified. A small entry point exports `calculate`, `Pokemon`, `Move`, `Field`, `Side`, `Generations`, `Stats`, and `toID`. It bypasses the upstream `index.ts` CommonJS/global shim, which is not safe as a native ESM entry.

Normal development and Cloudflare builds use this committed bundle and do not fetch GitHub. The published npm release 0.11.0 did not yet contain the Champions mechanics when the app was created; the pinned upstream revision does.

To intentionally update:

1. Fetch the desired upstream commit metadata into `.local/upstream-commit.json` (the GitHub commit response containing `sha`).
2. Extract that same commit's archive under `.local/upstream/` with one repository directory there.
3. Run `node scripts/vendor-engine.mjs` to rebuild the bundle and license metadata.
4. Run `npm run data:build`, inspect `docs/data-audit.json`, then run `npm test` and `npm run build`.
5. Verify changed/new mechanics against upstream tests and real game observations before claiming support. Do not rerun the one-time CSV repair scripts on user-edited source files.
