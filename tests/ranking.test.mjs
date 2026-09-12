import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseRanking } from "../scripts/ranking-data.mjs";
const pokemon = JSON.parse(
  await readFile("src/generated/data.json", "utf8"),
).pokemon;
test("Low Key Toxtricity shares all six base stats and displays Minus instead of Plus", () => {
  const [row] = parseRanking("順位,ポケモン名\n95,ストリンダー(ロー)", pokemon);
  const high = pokemon.find((p) => p.name === "ストリンダー");
  assert.equal(row.pokemonName, high.name);
  assert.deepEqual(row.profile.baseStats, high.baseStats);
  assert.deepEqual(row.profile.abilities, [
    "パンクロック",
    "マイナス",
    "テクニシャン",
  ]);
  assert.equal(row.profile.name, "ストリンダー(ロー)");
  assert.ok(high.abilities.includes("プラス"));
});
test("Ranking preserves source rates, resolves form aliases, and updates on CSV replacement", () => {
  const header = "\uFEFF順位,ポケモン名,技1,特性1,更新日\n";
  const first = parseRanking(
    header +
      "2,イルカマン,ウェーブタックル (0%),,2026/09/11\n1,キュウコンＡ,ふぶき (100%),,2026/09/11",
    pokemon,
  );
  assert.deepEqual(
    first.map((r) => r.rank),
    [1, 2],
  );
  assert.equal(first[0].pokemonName, "キュウコンA");
  assert.equal(first[1].pokemonName, "イルカマン（ナイーブ）");
  assert.equal(first[1].moves[0].rate, 0);
  const updated = parseRanking(
    header + "1,ガブリアス,じしん (12.5%),,2026/09/12",
    pokemon,
  );
  assert.equal(updated[0].name, "ガブリアス");
  assert.equal(updated[0].moves[0].rate, 12.5);
  assert.equal(updated[0].updated, "2026/09/12");
});
test("Ranking rejects invalid ranks and rates, leaves unknown forms unmapped", () => {
  const header = "順位,ポケモン名,技1\n";
  assert.throws(() =>
    parseRanking(header + "1,ガブリアス,じしん (101%)", pokemon),
  );
  assert.throws(() =>
    parseRanking(header + "1,ガブリアス,\n1,ボーマンダ,", pokemon),
  );
  assert.throws(() => parseRanking(header + "0,ガブリアス,", pokemon));
  assert.equal(
    parseRanking(header + "1,未登録フォルム,", pokemon)[0].pokemonName,
    null,
  );
});
test("Supplied ranking compiles without changing any usage observations", async () => {
  const rows = parseRanking(
    await readFile("data/ranking.csv", "utf8"),
    pokemon,
  );
  const generated = JSON.parse(
    await readFile("src/generated/ranking.json", "utf8"),
  );
  assert.ok(rows.length > 0);
  assert.deepEqual(rows, generated);
});
