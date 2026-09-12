import { parse } from "csv-parse/sync";

export function parseRanking(text, pokemon) {
  const aliases = {
    ギルガルド: "ギルガルド盾",
    イエッサン: "イエッサン♂",
    "イエッサン(メス)": "イエッサン♀",
    "フラエッテ(えいえん)": "フラエッテえいえん",
    アローラペルシアン: "ペルシアンA",
    イルカマン: "イルカマン（ナイーブ）",
    "イキリンコ(イエローフェザー)": "イキリンコ",
    "ストリンダー(ロー)": "ストリンダー",
  };
  const rows = parse(text, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  });
  const seen = new Set();
  return rows
    .map((r, index) => {
      const name = r["ポケモン名"]?.trim();
      const rank = Number(r["順位"]);
      if (!name || !Number.isInteger(rank) || rank < 1 || seen.has(rank))
        throw new Error(
          `ranking.csv ${index + 2}行目: 順位・名前が不正または順位が重複しています`,
        );
      seen.add(rank);
      const list = (prefix, count) =>
        Array.from({ length: count }, (_, i) => r[`${prefix}${i + 1}`]?.trim())
          .filter(Boolean)
          .map((value) => {
            const match = value.match(/^(.*?)\s*\(([\d.]+)%\)$/);
            if (
              !match ||
              !match[1].trim() ||
              !Number.isFinite(Number(match[2])) ||
              Number(match[2]) > 100
            )
              throw new Error(
                `ranking.csv ${index + 2}行目: 使用率の形式が不正です (${value})`,
              );
            return { name: match[1].trim(), rate: Number(match[2]) };
          });
      const normalized = name.normalize("NFKC");
      const resolved = aliases[normalized] || normalized;
      const species = pokemon.find(
        (p) => p.name.normalize("NFKC") === resolved.normalize("NFKC"),
      );
      return {
        rank,
        name,
        pokemonName: species?.name || null,
        profile:
          normalized === "ストリンダー(ロー)" && species
            ? {
                ...species,
                name: "ストリンダー(ロー)",
                en: "Toxtricity-Low-Key",
                abilities: species.abilities.map((ability) =>
                  ability === "プラス" ? "マイナス" : ability,
                ),
              }
            : null,
        updated: r["更新日"] || "",
        moves: list("技", 10),
        items: list("持ち物", 10),
        abilities: list("特性", 3),
        natures: list("性格", 10),
        spreads: list("努力値", 10),
      };
    })
    .sort((a, b) => a.rank - b.rank);
}
