import { readFile, writeFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
const audit = JSON.parse(await readFile("docs/data-audit.json", "utf8"));
const data = JSON.parse(await readFile("src/generated/data.json", "utf8"));
const labels = Object.fromEntries(
  data.pokemon.flatMap((p) =>
    p.types.map((type, i) => [type, p.typeLabels[i]]),
  ),
);
const rows = parse(await readFile("data/pokemon.csv", "utf8"), {
  columns: true,
  skip_empty_lines: true,
});
for (const diff of audit.typeDifferences) {
  const row = rows.find((r) => r.名前 === diff.pokemon);
  row.タイプ1 = labels[diff.engine[0]];
  row.タイプ2 = labels[diff.engine[1]] || "";
}
const keys = Object.keys(rows[0]),
  quote = (s) => '"' + String(s ?? "").replaceAll('"', '""') + '"';
await writeFile(
  "data/pokemon.csv",
  [
    keys.map(quote).join(","),
    ...rows.map((r) => keys.map((k) => quote(r[k])).join(",")),
  ].join("\r\n") + "\r\n",
);
const report = JSON.parse(await readFile("docs/data-corrections.json", "utf8"));
report.types = audit.typeDifferences;
await writeFile("docs/data-corrections.json", JSON.stringify(report, null, 2));
