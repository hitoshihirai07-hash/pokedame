import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { Generations, toID } from "../vendor/calc.js";
import { parseRanking } from "./ranking-data.mjs";

const csv = async (path) =>
  parse(await readFile(path, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
  });
const normalize = (s) =>
  String(s || "")
    .normalize("NFKC")
    .replace(/[\s・･’'：:‐－-]/g, "")
    .toLowerCase();
async function names(table) {
  const rows = await csv(`data/reference/${table}.csv`);
  const key = Object.keys(rows[0])[0];
  const english = Object.fromEntries(
    rows
      .filter((r) => r.local_language_id === "9")
      .map((r) => [r[key], r.name]),
  );
  return {
    byJapanese: Object.fromEntries(
      rows
        .filter((r) => ["1", "11"].includes(r.local_language_id))
        .map((r) => [normalize(r.name), english[r[key]]]),
    ),
    byId: english,
  };
}
const [
  pRows,
  mRows,
  aRows,
  iRows,
  nRows,
  megaRows,
  moveNames,
  abilityNames,
  itemNames,
  speciesNames,
] = await Promise.all([
  csv("data/pokemon.csv"),
  csv("data/moves.csv"),
  csv("data/characteristic_table.csv"),
  csv("data/belongings.csv"),
  csv("data/personality.csv"),
  csv("data/mega.csv"),
  names("move_names"),
  names("ability_names"),
  names("item_names"),
  names("pokemon_species_names"),
]);
const types = Object.fromEntries(
  [
    "ノーマル:Normal",
    "ほのお:Fire",
    "みず:Water",
    "でんき:Electric",
    "くさ:Grass",
    "こおり:Ice",
    "かくとう:Fighting",
    "どく:Poison",
    "じめん:Ground",
    "ひこう:Flying",
    "エスパー:Psychic",
    "むし:Bug",
    "いわ:Rock",
    "ゴースト:Ghost",
    "ドラゴン:Dragon",
    "あく:Dark",
    "はがね:Steel",
    "フェアリー:Fairy",
  ].map((s) => s.split(":")),
);
const statFields = {
  hp: "HP",
  atk: "攻撃",
  def: "防御",
  spa: "特攻",
  spd: "特防",
  spe: "素早",
};
const gen = Generations.get(0),
  old = Generations.get(9);
const pool = new Map([...old.species, ...gen.species].map((p) => [p.id, p]));
const natEnglish = [
  "Lonely",
  "Adamant",
  "Naughty",
  "Brave",
  "Bold",
  "Impish",
  "Lax",
  "Relaxed",
  "Modest",
  "Mild",
  "Rash",
  "Quiet",
  "Calm",
  "Gentle",
  "Careful",
  "Sassy",
  "Timid",
  "Hasty",
  "Jolly",
  "Naive",
  "Serious",
];
const natJapanese = [
  "さみしがり",
  "いじっぱり",
  "やんちゃ",
  "ゆうかん",
  "ずぶとい",
  "わんぱく",
  "のうてんき",
  "のんき",
  "ひかえめ",
  "おっとり",
  "うっかりや",
  "れいせい",
  "おだやか",
  "おとなしい",
  "しんちょう",
  "なまいき",
  "おくびょう",
  "せっかち",
  "ようき",
  "むじゃき",
  "まじめ",
];
const manualAbilities = {
  ドラゴンスキン: "Dragonize",
  どくぼうそう: "Toxic Boost",
  りゅうのあぎと: "Dragon’s Maw",
  メガソーラー: "Mega Sol",
  とびだすハバネロ: "Spicy Spray",
  うなぎのぼり: "Eelevate",
  ほのおのたてがみ: "Fire Mane",
  はどうのぼうご: "Aura Guard",
  じんばいったい: "As One (Glastrier)",
  おもかげやどし: "Embody Aspect (Teal)",
};
const manualSpecies = {
  "ニドラン♀": "Nidoran-F",
  "ニドラン♂": "Nidoran-M",
  フラベベ: "Flabebe",
  ウインディH: "Arcanine-Hisui",
  ヤドンG: "Slowpoke-Galar",
  ヤドキングG: "Slowking-Galar",
  ミノマダム鋼: "Wormadam-Trash",
  ミノマダム地面: "Wormadam-Sandy",
  マッギョG: "Stunfisk-Galar",
  メロエッタV: "Meloetta",
  メロエッタS: "Meloetta-Pirouette",
  ヌメイルH: "Sliggoo-Hisui",
  ヌメルゴンH: "Goodra-Hisui",
  ザシアン: "Zacian",
  ザシアン剣: "Zacian-Crowned",
  ザマゼンタ: "Zamazenta",
  ザマゼンタ盾: "Zamazenta-Crowned",
  ガチグマ: "Ursaluna",
  "ガチグマ（アカツキ）": "Ursaluna-Bloodmoon",
  ギラティナA: "Giratina",
  フーパ: "Hoopa",
};
const itemTypos = {
  ちからハチマキ: "ちからのハチマキ",
  フォーカスレズ: "フォーカスレンズ",
  エレキシードr: "エレキシード",
};
const stoneStems = {
  エンブオ: "エンブオー",
  スターミ: "スターミー",
  カイリュ: "カイリュー",
  ジジーロ: "ジジーロン",
  ピクシ: "ピクシー",
  マフォクシ: "マフォクシー",
  フラエッテ: "フラエッテ",
  スコヴィラ: "スコヴィラン",
  ペンドラ: "ペンドラー",
  ズルズキ: "ズルズキン",
  ドラミド: "ドラミドロ",
  カラマネ: "カラマネロ",
};
const lookup = (table, name) => table.byJapanese[normalize(name)];
const canonical = (kind, name) =>
  name && (gen[kind].get(toID(name)) || old[kind].get(toID(name)))?.name;
const audit = {
  unmappedPokemon: [],
  unmappedMoves: [],
  unmappedAbilities: [],
  unmappedItems: [],
  flagDifferences: [],
  invalidRows: [],
  dataDifferences: [],
  typeDifferences: [],
};
const abilities = aRows
  .filter((r) => r.特性)
  .map((r) => {
    const en = canonical(
      "abilities",
      manualAbilities[r.特性] || lookup(abilityNames, r.特性),
    );
    if (!en) audit.unmappedAbilities.push(r.特性);
    return { name: r.特性, en: en || null, description: r.効果 || "" };
  });
const items = iRows
  .filter((r) => r.名前)
  .map((r) => {
    let en = canonical("items", lookup(itemNames, itemTypos[r.名前] || r.名前));
    if (!en && r.名前.includes("ナイト")) {
      const stoneName = r.名前
        .replace("ブリガロナイト", "ブリガロンナイト")
        .replace("シビルドナイト", "シビルドンナイト");
      const stem = stoneName.split("ナイト")[0];
      const base = lookup(speciesNames, stoneStems[stem] || stem);
      const suffix = stoneName.split("ナイト")[1].normalize("NFKC");
      const stone = [...gen.items, ...old.items].find(
        (i) =>
          i.megaStone &&
          Object.entries(i.megaStone).some(
            ([b, f]) =>
              (b === base || b === `${base}-Eternal`) &&
              (!suffix || f.endsWith(suffix)),
          ),
      );
      en = stone?.name;
    }
    if (!en) audit.unmappedItems.push(r.名前);
    return { name: r.名前, en: en || null, description: r.効果 || "" };
  });
const pokemon = pRows
  .filter((r) => {
    const ok =
      r.名前 &&
      Object.values(statFields).every(
        (k) => r[k] !== "" && Number.isFinite(Number(r[k])),
      );
    if (!ok) audit.invalidRows.push(r.名前 || "(空行)");
    return ok;
  })
  .map((r) => {
    const base = lookup(speciesNames, r.名前) || speciesNames.byId[r.No];
    const stats = Object.fromEntries(
      Object.entries(statFields).map(([k, col]) => [k, Number(r[col])]),
    );
    const ts = [types[r.タイプ1], types[r.タイプ2]].filter(Boolean);
    const family = [...pool.values()].filter(
      (p) =>
        base &&
        (p.name === base ||
          p.name.startsWith(`${base}-`) ||
          p.baseSpecies === base),
    );
    const matches = family.filter(
      (p) =>
        Object.keys(stats).every((k) => p.baseStats[k] === stats[k]) &&
        p.types.join() === ts.join(),
    );
    let selected = manualSpecies[r.名前]
      ? pool.get(toID(manualSpecies[r.名前]))
      : matches.length === 1
        ? matches[0]
        : matches.find((p) => p.name === base);
    if (!selected && r.名前.startsWith("メガ")) {
      const suffix = r.名前.match(/[XYZ]$/)?.[0];
      const candidates = family.filter(
        (p) => p.name.includes("-Mega") && (!suffix || p.name.endsWith(suffix)),
      );
      if (candidates.length === 1) selected = candidates[0];
    }
    // Equal-stat cosmetic forms are damage-equivalent; preserve canonical base where possible.
    if (!selected && matches.length) selected = matches[0];
    if (!selected && lookup(speciesNames, r.名前))
      selected = pool.get(toID(lookup(speciesNames, r.名前)));
    if (!selected && family.length === 1) selected = family[0];
    if (!selected) audit.unmappedPokemon.push(r.名前);
    if (
      selected &&
      Object.keys(stats).some((k) => selected.baseStats[k] !== stats[k])
    )
      audit.dataDifferences.push({
        pokemon: r.名前,
        csv: stats,
        engine: selected.baseStats,
      });
    if (selected && [...ts].sort().join() !== [...selected.types].sort().join())
      audit.typeDifferences.push({
        pokemon: r.名前,
        csv: ts,
        engine: selected.types,
      });
    return {
      name: r.名前,
      en: selected?.name || null,
      no: Number(r.No),
      types: ts,
      typeLabels: [r.タイプ1, r.タイプ2].filter(Boolean),
      baseStats: stats,
      weightkg: Number(r.おもさ),
      available: String(r.使用可能).trim().toUpperCase() === "TRUE",
      abilities: [r.とくせい1, r.とくせい2, r.かくれとくせい].filter(Boolean),
      nfe: selected?.nfe || false,
    };
  });
const flagCols = {
  contact: "接触",
  slicing: "切る技",
  sound: "音技",
  punch: "パンチ技",
  bite: "かみつき技",
  pulse: "波動技",
  bullet: "弾技",
  wind: "風技",
};
const moves = mRows
  .filter((r) => r.name)
  .map((r) => {
    const en = canonical("moves", lookup(moveNames, r.name));
    const source = en && (gen.moves.get(toID(en)) || old.moves.get(toID(en)));
    if (!en) audit.unmappedMoves.push(r.name);
    const flags = {};
    for (const [key, col] of Object.entries(flagCols)) {
      const raw = String(r[col] || "")
        .trim()
        .toUpperCase();
      flags[key] = raw === "TRUE" ? 1 : 0;
      if (raw === "" && source?.flags?.[key])
        audit.flagDifferences.push({
          move: r.name,
          column: col,
          value: "TRUE",
          source: en,
        });
    }
    return {
      name: r.name,
      en: en || null,
      type: types[r.type],
      typeLabel: r.type,
      category:
        r.category === "物理"
          ? "Physical"
          : r.category === "特殊"
            ? "Special"
            : "Status",
      power:
        r.power !== "" && Number.isFinite(Number(r.power))
          ? Number(r.power)
          : null,
      hits: r.hits,
      alwaysCrit: String(r.alwaysCrit).toUpperCase() === "TRUE",
      flags,
      description: r.効果 || "",
      notes: r.notes || "",
      engineAvailable: !!(en && gen.moves.get(toID(en))),
    };
  });
const natures = nRows.map((r) => ({
  name: r.性格,
  en: natEnglish[natJapanese.indexOf(r.性格)],
  plus:
    Object.keys(statFields).find(
      (k) => r[k === "spe" ? "素早さ" : statFields[k]] === "○",
    ) || null,
  minus:
    Object.keys(statFields).find(
      (k) => r[k === "spe" ? "素早さ" : statFields[k]] === "×",
    ) || null,
}));
const megas = megaRows.map((r) => ({
  base: r.元ポケモン名,
  name: r.ポケモン名,
}));
await mkdir("src/generated", { recursive: true });
await mkdir("docs", { recursive: true });
const ranking = parseRanking(
  await readFile("data/ranking.csv", "utf8"),
  pokemon,
);
await writeFile("src/generated/ranking.json", JSON.stringify(ranking));
await writeFile(
  "docs/ranking-audit.json",
  JSON.stringify(
    {
      count: ranking.length,
      unmatched: ranking.filter((r) => !r.pokemonName).map((r) => r.name),
    },
    null,
    2,
  ),
);
await writeFile(
  "src/generated/data.json",
  JSON.stringify({ pokemon, moves, abilities, items, natures, megas }),
);
await writeFile("docs/data-audit.json", JSON.stringify(audit, null, 2));
console.log(
  JSON.stringify(
    {
      pokemon: pokemon.length,
      moves: moves.length,
      abilities: abilities.length,
      items: items.length,
      natures: natures.length,
      ...Object.fromEntries(
        Object.entries(audit).map(([k, v]) => [k, v.length]),
      ),
    },
    null,
    2,
  ),
);
