// One-time, reviewable correction. Normal builds never modify the source CSVs.
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
const audit = JSON.parse(await readFile("docs/data-audit.json", "utf8"));
await mkdir("data/original", { recursive: true });
function serialize(rows) {
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const quote = (s) => '"' + String(s ?? "").replaceAll('"', '""') + '"';
  return (
    [
      keys.map(quote).join(","),
      ...rows.map((r) => keys.map((k) => quote(r[k])).join(",")),
    ].join("\r\n") + "\r\n"
  );
}
for (const file of ["moves.csv", "pokemon.csv"]) {
  await copyFile(`data/${file}`, `data/original/${file}`, 1);
  const rows = parse(await readFile(`data/${file}`, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
  });
  if (file === "moves.csv") {
    for (const diff of audit.flagDifferences)
      rows.find((r) => r.name === diff.move)[diff.column] = diff.value;
  } else {
    const keys = {
      hp: "HP",
      atk: "攻撃",
      def: "防御",
      spa: "特攻",
      spd: "特防",
      spe: "素早",
    };
    for (const diff of audit.dataDifferences)
      for (const [key, column] of Object.entries(keys))
        rows.find((r) => r.名前 === diff.pokemon)[column] = diff.engine[key];
  }
  await writeFile(`data/${file}`, serialize(rows));
}
await writeFile(
  "docs/data-corrections.json",
  JSON.stringify(
    {
      source: "vendor/upstream.json",
      note: "Original CSV files retained in data/original. Flags and base stats corrected against the pinned engine. No correction runs during normal builds.",
      flags: audit.flagDifferences,
      stats: audit.dataDifferences,
    },
    null,
    2,
  ),
);
