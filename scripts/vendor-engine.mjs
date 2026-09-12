import { build } from "esbuild";
import {
  readdir,
  readFile,
  mkdir,
  copyFile,
  writeFile,
} from "node:fs/promises";
const commit = JSON.parse(
  await readFile(".local/upstream-commit.json", "utf8"),
).sha;
const root = `.local/upstream/${(await readdir(".local/upstream"))[0]}`;
await mkdir("vendor", { recursive: true });
await writeFile(
  `${root}/calc/src/lab-entry.ts`,
  `export {calculate} from './calc';\nexport {Pokemon} from './pokemon';\nexport {Move} from './move';\nexport {Field,Side} from './field';\nexport {Generations} from './data';\nexport {Stats} from './stats';\nexport {toID} from './util';\n`,
);
await build({
  entryPoints: [`${root}/calc/src/lab-entry.ts`],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: "vendor/calc.js",
  legalComments: "inline",
});
await copyFile(`${root}/LICENSE`, "vendor/LICENSE-smogon");
await writeFile(
  "vendor/upstream.json",
  JSON.stringify(
    {
      repository: "https://github.com/smogon/damage-calc",
      commit,
      engine: "Champions (generation 0)",
      bundledAt: "2026-09-11",
    },
    null,
    2,
  ),
);
