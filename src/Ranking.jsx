import React, { useMemo, useState } from "react";
import ranking from "./generated/ranking.json";
import { data, STATS, LABELS } from "./engine.mjs";

function Usage({ title, entries, descriptions }) {
  return (
    <section className="panel ranking-usage">
      <h3>{title}</h3>
      {entries.length ? (
        entries.map((entry, i) => (
          <div className="usage-row" key={`${entry.name}-${i}`}>
            <div>
              <span>{entry.name}</span>
              <strong>{entry.rate}%</strong>
            </div>
            <div className="usage-track">
              <span style={{ width: `${entry.rate}%` }} />
            </div>
            {descriptions?.find((d) => d.name === entry.name)?.description && (
              <p>
                {descriptions.find((d) => d.name === entry.name).description}
              </p>
            )}
          </div>
        ))
      ) : (
        <p>データなし</p>
      )}
    </section>
  );
}

export default function Ranking() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(ranking[0]?.rank);
  const [form, setForm] = useState("");
  const filtered = useMemo(
    () =>
      ranking.filter((r) =>
        r.name.normalize("NFKC").includes(query.normalize("NFKC").trim()),
      ),
    [query],
  );
  const row = ranking.find((r) => r.rank === selected);
  const base =
    row?.profile || data.pokemon.find((p) => p.name === row?.pokemonName);
  const formNames = base
    ? [
        base.name,
        ...data.megas.filter((m) => m.base === base.name).map((m) => m.name),
        ...(base.name === "ギルガルド盾" ? ["ギルガルド剣"] : []),
        ...(base.name === "イルカマン（ナイーブ）"
          ? ["イルカマン（マイティ）"]
          : []),
      ]
    : [];
  const species = form ? data.pokemon.find((p) => p.name === form) : base;
  return (
    <div className="ranking-layout">
      <section className="panel ranking-list">
        <h2>使用率ランキング</h2>
        <label>
          ポケモン名で検索
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ガブリアス"
          />
        </label>
        <p>
          {filtered.length} / {ranking.length}件
        </p>
        <div className="ranking-scroll">
          {filtered.map((r) => (
            <button
              key={r.rank}
              aria-pressed={selected === r.rank}
              onClick={() => {
                setSelected(r.rank);
                setForm("");
              }}
            >
              <b>{r.rank}</b>
              <span>{r.name}</span>
              <span aria-hidden="true">›</span>
            </button>
          ))}
          {!filtered.length && <p>該当するポケモンがありません。</p>}
        </div>
      </section>
      {row && (
        <div className="ranking-detail">
          <section className="panel ranking-profile">
            <div className="ranking-title">
              <div>
                <p>
                  RANK {row.rank} ・ 更新日 {row.updated || "未記載"}
                </p>
                <h2>{row.name}</h2>
              </div>
              {formNames.length > 1 && (
                <label>
                  種族値を確認するフォルム
                  <select
                    value={form || base.name}
                    onChange={(e) => setForm(e.target.value)}
                  >
                    {formNames.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {species ? (
              <>
                <p>
                  {species.name} ｜ {species.typeLabels.join(" / ")} ｜{" "}
                  {species.weightkg} kg
                </p>
                <div className="ranking-stats">
                  {STATS.map((key) => (
                    <div key={key}>
                      <span>{LABELS[key]}</span>
                      <strong>{species.baseStats[key]}</strong>
                      <div className="usage-track">
                        <span
                          style={{
                            width: `${(species.baseStats[key] / 255) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p>
                  種族値合計{" "}
                  <b>
                    {Object.values(species.baseStats).reduce(
                      (a, b) => a + b,
                      0,
                    )}
                  </b>
                </p>
                <h3>特性</h3>
                {species.abilities.map((name) => (
                  <div className="ranking-ability" key={name}>
                    <strong>{name}</strong>
                    <p>
                      {data.abilities.find((a) => a.name === name)
                        ?.description || "説明データなし"}
                    </p>
                  </div>
                ))}
              </>
            ) : (
              <p role="status">
                このフォルムに対応する種族値・特性がpokemon.csvにありません。ランキングの内容のみ表示しています。
              </p>
            )}
          </section>
          <p className="ranking-note">
            ランキング・使用率はCSVの値です。各項目は独立した集計で、技・持ち物・性格・配分の組み合わせを示すものではありません。フォルム切り替えは種族値・特性の表示にのみ反映します。
          </p>
          <div className="ranking-usage-grid">
            <Usage
              title="よく使われる技"
              entries={row.moves}
              descriptions={data.moves}
            />
            <Usage
              title="持ち物"
              entries={row.items}
              descriptions={data.items}
            />
            <Usage
              title="特性の使用率"
              entries={row.abilities}
              descriptions={data.abilities}
            />
            <Usage title="性格" entries={row.natures} />
            <Usage
              title="能力ポイント配分（CSVの努力値欄）"
              entries={row.spreads}
            />
          </div>
        </div>
      )}
    </div>
  );
}
