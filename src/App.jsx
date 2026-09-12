import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import Ranking from "./Ranking.jsx";
import {
  data,
  find,
  STATS,
  LABELS,
  zeroPoints,
  defaultSide,
  defaultConfig,
  buildPokemon,
  calculateOne,
  compareExtremes,
  moveAxes,
} from "./engine.mjs";

const pct = (n) => Number(n).toFixed(1);
const multiplier = (n) =>
  n === 1.1 ? "上昇 ×1.1" : n === 0.9 ? "低下 ×0.9" : "無補正";
const KEY = "champions-damage-lab:history:v1";
function loadHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list)
      ? list
          .filter(
            (r) => r.version === 1 && r.config?.attacker && r.config?.defender,
          )
          .slice(0, 50)
      : [];
  } catch {
    return [];
  }
}
function Icon({ name }) {
  const paths = {
    calc: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M8 7h8M8 11h1m3 0h1m3 0h0M8 15h1m3 0h1m3 0h0M8 18h1m3 0h1" />
      </>
    ),
    percent: (
      <>
        <path d="m5 20 14-16" />
        <circle cx="6" cy="6" r="3" />
        <circle cx="18" cy="18" r="3" />
      </>
    ),
    history: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 3" />
      </>
    ),
    logo: (
      <>
        <path d="m12 2 9 5v10l-9 5-9-5V7Z" />
        <path d="m8 13 3 2 6-5" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
function SearchField({ label, value, onChange, options, id, placeholder }) {
  const autoId = useId();
  const uid = id || autoId;
  return (
    <label className="field">
      <span>{label}</span>
      <input
        id={uid}
        list={`${uid}-list`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "名前を入力して検索"}
        autoComplete="off"
      />
      <datalist id={`${uid}-list`}>
        {options.map((o) => (
          <option
            key={typeof o === "string" ? o : o.name}
            value={typeof o === "string" ? o : o.name}
          />
        ))}
      </datalist>
    </label>
  );
}
function SelectField({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option
            key={typeof o === "string" ? o : o.value}
            value={typeof o === "string" ? o : o.value}
          >
            {typeof o === "string" ? o : o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function Check({ label, checked, onChange }) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
function PokemonPanel({ side, role, onChange, availableOnly, inverse }) {
  const p = find("pokemon", side.name);
  const [more, setMore] = useState(false);
  const allPokemon = useMemo(
    () => data.pokemon.filter((p) => !availableOnly || p.available),
    [availableOnly],
  );
  const base = data.megas.find((m) => m.name === side.name)?.base || side.name;
  const forms = data.megas
    .filter((m) => m.base === base)
    .filter((m) => !availableOnly || find("pokemon", m.name)?.available);
  const isMega = side.name !== base;
  let stats;
  try {
    stats = buildPokemon(side).rawStats;
  } catch {
    stats = null;
  }
  const set = (key, value) => onChange({ ...side, [key]: value });
  function selectPokemon(name) {
    const selected = find("pokemon", name);
    if (data.megas.some((m) => m.name === name)) {
      selectMega(name);
      return;
    }
    onChange({ ...side, name, ability: selected?.abilities[0] || "" });
  }
  function selectMega(name) {
    const selected = find("pokemon", name);
    const item =
      selected?.en &&
      data.items.find((i) => i.en && megaStoneMatches(i.en, selected.en));
    onChange({
      ...side,
      name,
      ability: selected?.abilities[0] || "",
      item: item?.name || "",
    });
  }
  return (
    <section
      className={`pokemon-panel panel ${role}`}
      aria-label={role === "attacker" ? "攻撃側の設定" : "防御側の設定"}
    >
      <div className="panel-heading">
        <h2>{role === "attacker" ? "攻撃側" : "防御側"}</h2>
        <span className="type-label">
          {p?.typeLabels.join(" / ") || "ポケモンを選択"}
        </span>
      </div>
      <SearchField
        label="ポケモン"
        id={`${role}-pokemon`}
        value={side.name}
        options={allPokemon}
        onChange={selectPokemon}
      />
      {availableOnly && p && !p.available && (
        <p className="inline-note">選択中のポケモンは使用可能リスト外です。</p>
      )}
      <SelectField
        label="特性"
        value={side.ability}
        onChange={(v) => set("ability", v)}
        options={[
          { value: "", label: "なし" },
          ...(p?.abilities || []).map((a) => ({ value: a, label: a })),
        ]}
      />
      <SearchField
        label="持ち物"
        id={`${role}-item`}
        value={side.item}
        onChange={(v) => set("item", v)}
        options={data.items}
        placeholder="なし（空欄）"
      />
      <SelectField
        label="性格"
        value={side.nature}
        onChange={(v) => set("nature", v)}
        options={data.natures.map((n) => ({
          value: n.name,
          label: `${n.name}${n.plus ? `（${LABELS[n.plus]}↑ ${LABELS[n.minus]}↓）` : "（無補正）"}`,
        }))}
      />
      <div className="mega-row">
        <span>メガ進化</span>
        {forms.length ? (
          <div className="mega-controls">
            <button
              type="button"
              className={`toggle ${isMega ? "on" : ""}`}
              aria-label={`${role === "attacker" ? "攻撃側" : "防御側"}をメガ進化に切り替え`}
              aria-pressed={isMega}
              onClick={() =>
                isMega ? selectPokemon(base) : selectMega(forms[0].name)
              }
            >
              <i />
            </button>
            {isMega ? (
              <select
                aria-label="メガ進化先"
                value={side.name}
                onChange={(e) => selectMega(e.target.value)}
              >
                {forms.map((m) => (
                  <option key={m.name}>{m.name}</option>
                ))}
              </select>
            ) : (
              <span className="muted">しない</span>
            )}
          </div>
        ) : (
          <span className="muted">対象外</span>
        )}
      </div>
      <div className="stats-head">
        <span>能力ポイント</span>
        <span
          className={
            STATS.reduce((s, k) => s + Number(side.points[k] || 0), 0) > 66
              ? "danger"
              : "muted"
          }
        >
          合計 {STATS.reduce((s, k) => s + Number(side.points[k] || 0), 0)} / 66
        </span>
      </div>
      <div className="stats-grid">
        {STATS.map((k) => (
          <label key={k}>
            <span>{LABELS[k]}</span>
            <input
              aria-label={`${role === "attacker" ? "攻撃側" : "防御側"} ${LABELS[k]}ポイント`}
              type="number"
              min="0"
              max="32"
              step="1"
              value={side.points[k]}
              onChange={(e) =>
                set("points", {
                  ...side.points,
                  [k]: e.target.value === "" ? "" : Number(e.target.value),
                })
              }
            />
            <small>{stats ? stats[k] : "—"}</small>
          </label>
        ))}
      </div>
      <div className="stats-foot">
        <span>下段：実数値</span>
        <button
          className="text-button"
          onClick={() => setMore(!more)}
          aria-expanded={more}
        >
          特性・持ち物の説明 {more ? "−" : "＋"}
        </button>
      </div>
      {inverse && role === "defender" && (
        <p className="inline-note">
          逆算ではHP・対象の防御能力・性格補正を探索します。他のポイントは入力値で固定します。
        </p>
      )}
      {more && (
        <div className="description">
          <p>
            <strong>{side.ability || "特性なし"}</strong>{" "}
            {find("abilities", side.ability)?.description}
          </p>
          <p>
            <strong>{side.item || "持ち物なし"}</strong>{" "}
            {find("items", side.item)?.description}
          </p>
        </div>
      )}
    </section>
  );
}
// Keep stone selection consistent with the exact form used by the engine.
import { generation } from "./engine.mjs";
import { toID } from "../vendor/calc.js";
function megaStoneMatches(item, form) {
  return Object.values(
    generation.items.get(toID(item))?.megaStone || {},
  ).includes(form);
}
function Details({ config, setConfig }) {
  const change = (key, v) => setConfig({ ...config, [key]: v });
  return (
    <details className="panel details">
      <summary>
        詳細条件 <span>現在HP・能力ランク・急所・壁など</span>
      </summary>
      <div className="details-body">
        <div className="checks">
          <Check
            label="急所"
            checked={config.critical}
            onChange={(v) => change("critical", v)}
          />
          <Check
            label="リフレクター"
            checked={config.reflect}
            onChange={(v) => change("reflect", v)}
          />
          <Check
            label="ひかりのかべ"
            checked={config.lightScreen}
            onChange={(v) => change("lightScreen", v)}
          />
          <Check
            label="オーロラベール"
            checked={config.auroraVeil}
            onChange={(v) => change("auroraVeil", v)}
          />
          <Check
            label="まもる"
            checked={config.protected}
            onChange={(v) => change("protected", v)}
          />
          <Check
            label="じゅうりょく"
            checked={config.gravity}
            onChange={(v) => change("gravity", v)}
          />
          <Check
            label="ワンダールーム"
            checked={config.wonderRoom}
            onChange={(v) => change("wonderRoom", v)}
          />
          <Check
            label="マジックルーム"
            checked={config.magicRoom}
            onChange={(v) => change("magicRoom", v)}
          />
        </div>
        <div className="detail-sides">
          {["attacker", "defender"].map((role) => (
            <div key={role}>
              <h3>{role === "attacker" ? "攻撃側" : "防御側"}</h3>
              <div className="detail-fields">
                <label className="field">
                  <span>現在HP（％）</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={config[role].hpPercent}
                    onChange={(e) =>
                      change(role, {
                        ...config[role],
                        hpPercent: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <SelectField
                  label="状態異常"
                  value={config[role].status}
                  onChange={(v) => change(role, { ...config[role], status: v })}
                  options={[
                    { value: "", label: "なし" },
                    { value: "brn", label: "やけど" },
                    { value: "par", label: "まひ" },
                    { value: "psn", label: "どく" },
                    { value: "tox", label: "もうどく" },
                    { value: "slp", label: "ねむり" },
                    { value: "frz", label: "こおり" },
                  ]}
                />
              </div>
              <div className="boost-grid">
                {STATS.filter((k) => k !== "hp").map((k) => (
                  <label key={k}>
                    <span>{LABELS[k]}ランク</span>
                    <select
                      aria-label={`${role === "attacker" ? "攻撃側" : "防御側"} ${LABELS[k]}ランク`}
                      value={config[role].boosts[k]}
                      onChange={(e) =>
                        change(role, {
                          ...config[role],
                          boosts: {
                            ...config[role].boosts,
                            [k]: Number(e.target.value),
                          },
                        })
                      }
                    >
                      {Array.from({ length: 13 }, (_, i) => i - 6).map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <Check
                label="特性の発動条件を満たす"
                checked={config[role].abilityOn}
                onChange={(v) =>
                  change(role, { ...config[role], abilityOn: v })
                }
              />
              <p className="helper">
                いかく・もらいび等の発動条件。マルチスケイル等は現在HPから判定します。天候・場を変える特性は選択時に上の設定へ反映します。
              </p>
              <label className="field">
                <span>ひんしの味方（そうだいしょう）</span>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={config[role].alliesFainted}
                  onChange={(e) =>
                    change(role, {
                      ...config[role],
                      alliesFainted: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
          ))}
        </div>
        <p className="helper">
          現在HPの％指定は最大HPから切り捨てた実数で計算します。逆算の防御側HPは、各記録の表示範囲を探索します。
        </p>
      </div>
    </details>
  );
}
function Result({ result, config, onSave }) {
  const max = result.distribution.reduce(
    (m, r) => Math.max(m, r.probability),
    0,
  );
  return (
    <>
      <section className="panel result-panel">
        <div className="panel-heading">
          <h2>計算結果</h2>
          <button className="text-button" onClick={onSave}>
            履歴に保存
          </button>
        </div>
        <div className="result-numbers">
          <strong>
            {pct(result.lowPercent)} – {pct(result.highPercent)}
            <small>％</small>
          </strong>
          <span>
            {result.low} – {result.high}
            <small> ダメージ</small>
          </span>
        </div>
        <div className="hp-caption">
          <span>
            {config.defender.name}の最大HP {result.hp} に対して
          </span>
          <span>
            {result.ko === 1
              ? "確定1発"
              : result.ko === 0
                ? "この攻撃では倒せない"
                : `撃破率 ${pct(result.ko * 100)}％`}
          </span>
        </div>
        <div className="hp-bar">
          <div style={{ width: `${Math.min(100, result.highPercent)}%` }} />
          <div style={{ width: `${Math.min(100, result.lowPercent)}%` }} />
        </div>
        <div className="helper">
          {config.attacker.name} → {config.defender.name} / {config.move}{" "}
          {result.hits > 1 ? `/ ${result.hits}ヒット合計` : ""}
        </div>
        {result.warnings.map((w) => (
          <p className="inline-note" key={w}>
            {w}
          </p>
        ))}
      </section>
      <details className="panel rolls">
        <summary>
          {result.rolls?.length === 16 ? "16段階の乱数" : "ダメージ分布"}
          <span>ダメージと最大HPに対する割合</span>
        </summary>
        {result.rolls?.length === 16 ? (
          <div className="roll-grid">
            {result.rolls.map((v, i) => (
              <div key={i}>
                <small>{85 + i}％乱数</small>
                <strong>{v}</strong>
                <span>{pct((v / result.hp) * 100)}％</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="distribution">
            <p className="helper">
              各ヒットの乱数を独立として合成。命中したヒット数は指定値で固定しています。
            </p>
            <div className="distribution-bars">
              {result.distribution.map((r) => (
                <div
                  key={r.damage}
                  title={`${r.damage}ダメージ / ${pct(r.probability * 100)}％`}
                >
                  <i
                    style={{
                      height: `${Math.max(1, (r.probability / max) * 80)}px`,
                    }}
                  />
                  <small>{r.damage}</small>
                </div>
              ))}
            </div>
          </div>
        )}
      </details>
    </>
  );
}
function Comparison({ comparison, compareError }) {
  const [page, setPage] = useState(0);
  const [order, setOrder] = useState("default");
  useEffect(() => setPage(0), [comparison]);
  const rows = useMemo(() => {
    if (!comparison) return [];
    return order === "default"
      ? comparison.rows
      : [...comparison.rows].sort((a, b) =>
          order === "asc"
            ? a.highPercent - b.highPercent
            : b.highPercent - a.highPercent,
        );
  }, [comparison, order]);
  if (compareError) return <p className="panel notice">{compareError}</p>;
  if (!comparison) return null;
  return (
    <section className="panel comparison">
      <div className="panel-heading">
        <div className="heading-group">
          <h2>最小・最大の配分比較</h2>
          <span className="muted">72通り</span>
        </div>
        <select
          aria-label="比較結果の並び順"
          value={order}
          onChange={(e) => {
            setOrder(e.target.value);
            setPage(0);
          }}
        >
          <option value="default">配分順</option>
          <option value="desc">最大ダメージが高い順</option>
          <option value="asc">最大ダメージが低い順</option>
        </select>
      </div>
      <p className="helper">
        比較対象以外のポイントは0。補正は対応する代表性格を使用します。持ち物・特性・場の条件は共通です。
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{LABELS[comparison.axes.attack]}Pt</th>
              <th>攻撃側補正</th>
              <th>HP Pt</th>
              <th>{LABELS[comparison.axes.defense]}Pt</th>
              <th>防御側補正</th>
              <th>ダメージ</th>
              <th>割合</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(page * 12, page * 12 + 12).map((r) => (
              <tr key={r.id}>
                <td>{r.ap}</td>
                <td>{multiplier(r.am)}</td>
                <td>{r.hpPoint}</td>
                <td>{r.dp}</td>
                <td>{multiplier(r.dm)}</td>
                <td>
                  <details className="row-rolls">
                    <summary>
                      {r.low} – {r.high}
                    </summary>
                    <div>
                      {(r.rolls || r.distribution.map((x) => x.damage)).map(
                        (damage, i) => (
                          <span key={i}>
                            {damage} / {pct((damage / r.hp) * 100)}％
                          </span>
                        ),
                      )}
                    </div>
                  </details>
                </td>
                <td className="emphasis">
                  {pct(r.lowPercent)} – {pct(r.highPercent)}％
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span>
          {page * 12 + 1}–{Math.min(page * 12 + 12, rows.length)} /{" "}
          {rows.length}件
        </span>
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>
          前へ
        </button>
        <button
          disabled={(page + 1) * 12 >= rows.length}
          onClick={() => setPage(page + 1)}
        >
          次へ
        </button>
      </div>
    </section>
  );
}
function Observations({ observations, setObservations }) {
  const [mode, setMode] = useState("remaining");
  const [before, setBefore] = useState(100);
  const [after, setAfter] = useState(73);
  const [damage, setDamage] = useState(27);
  const [error, setError] = useState("");
  function add() {
    const row =
      mode === "remaining"
        ? { before: Number(before), after: Number(after) }
        : { before: 100, after: 100 - Number(damage) };
    if (
      !Number.isInteger(row.before) ||
      !Number.isInteger(row.after) ||
      row.before < 1 ||
      row.before > 100 ||
      row.after < 0 ||
      row.after > row.before
    ) {
      setError("整数％で、攻撃後が攻撃前以下になるよう入力してください。");
      return;
    }
    setError("");
    setObservations([...observations, row]);
  }
  return (
    <section className="panel observations">
      <div className="panel-heading">
        <h2>観測したHP％</h2>
        <div className="segment">
          <button
            className={mode === "remaining" ? "active" : ""}
            onClick={() => setMode("remaining")}
          >
            攻撃前・攻撃後
          </button>
          <button
            className={mode === "damage" ? "active" : ""}
            onClick={() => setMode("damage")}
          >
            与えた％
          </button>
        </div>
      </div>
      <div className="observation-inputs">
        {mode === "remaining" ? (
          <>
            <label className="field">
              <span>攻撃前（％）</span>
              <input
                aria-label="観測 攻撃前％"
                type="number"
                min="1"
                max="100"
                step="1"
                value={before}
                onChange={(e) => setBefore(e.target.value)}
              />
            </label>
            <label className="field">
              <span>攻撃後（％）</span>
              <input
                aria-label="観測 攻撃後％"
                type="number"
                min="0"
                max="100"
                step="1"
                value={after}
                onChange={(e) => setAfter(e.target.value)}
              />
            </label>
          </>
        ) : (
          <label className="field">
            <span>満タンから与えたダメージ（％）</span>
            <input
              aria-label="与えたダメージ％"
              type="number"
              min="0"
              max="100"
              step="1"
              value={damage}
              onChange={(e) => setDamage(e.target.value)}
            />
          </label>
        )}
        <button className="secondary" onClick={add}>
          記録を追加
        </button>
      </div>
      <p className="helper">
        切り捨て表示として判定。「与えた％」は100％からの表示減少です。0％はひんし。同じ技・持ち物・場の条件で、回復などが入る前の記録を使ってください。
      </p>
      {error && (
        <p role="alert" className="danger">
          {error}
        </p>
      )}
      <div className="observation-list">
        {observations.length ? (
          observations.map((o, i) => (
            <div key={i}>
              <span>記録 {i + 1}</span>
              <strong>
                {o.before}％ → {o.after === 0 ? "ひんし" : `${o.after}％`}
              </strong>
              <button
                className="text-button"
                aria-label={`記録${i + 1}を削除`}
                onClick={() =>
                  setObservations(observations.filter((_, j) => j !== i))
                }
              >
                削除
              </button>
            </div>
          ))
        ) : (
          <p className="muted">
            記録を追加してから「候補を探索」を押してください。
          </p>
        )}
      </div>
    </section>
  );
}
function InferenceResult({ result, onSave }) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [result]);
  return (
    <section className="panel inference-results">
      <div className="panel-heading">
        <h2>一致する配分候補</h2>
        <button className="text-button" onClick={onSave}>
          履歴に保存
        </button>
      </div>
      <div className="inference-count">
        <strong>{result.groups.length}</strong>
        <span>グループ / {result.total}候補</span>
      </div>
      <p className="helper">
        同じ最大HP・防御実数値・一致乱数になる候補を統合しています。一致乱数の割合は採用率や性格の確率ではありません。複数記録では、各記録との一致率の積で並べます。
      </p>
      {!result.groups.length ? (
        <p className="empty-message">
          一致する候補がありません。技・特性・持ち物・壁・急所や、HP表示の読み取りを確認してください。
        </p>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>HP実数</th>
                  <th>{LABELS[result.axes.defense]}実数</th>
                  <th>一致する配分・補正</th>
                  <th>各記録の一致乱数</th>
                </tr>
              </thead>
              <tbody>
                {result.groups.slice(page * 15, page * 15 + 15).map((g, i) => (
                  <tr key={i}>
                    <td>{g.maxHP}</td>
                    <td>{g.defense}</td>
                    <td>
                      <details>
                        <summary>
                          {g.variants.length}候補 / H {g.variants[0].hp}・
                          {LABELS[result.axes.defense]} {g.variants[0].dp}・
                          {multiplier(g.variants[0].mult)}
                        </summary>
                        <ul>
                          {g.variants.map((v, j) => (
                            <li key={j}>
                              HP {v.hp} / {LABELS[result.axes.defense]} {v.dp} /{" "}
                              {multiplier(v.mult)}
                              {v.natures ? `（${v.natures.join("・")}）` : ""}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </td>
                    <td>
                      {g.counts.map((c, j) => (
                        <span key={j} className="match-count">
                          {c.matched}/{c.total}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>
              {page * 15 + 1}–{Math.min(page * 15 + 15, result.groups.length)} /{" "}
              {result.groups.length}件
            </span>
            <button disabled={!page} onClick={() => setPage(page - 1)}>
              前へ
            </button>
            <button
              disabled={(page + 1) * 15 >= result.groups.length}
              onClick={() => setPage(page + 1)}
            >
              次へ
            </button>
          </div>
        </>
      )}
    </section>
  );
}
function History({ history, onRestore, onRemove, onClear }) {
  const exportHistory = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(history, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "champions-calculation-history.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="panel history-panel">
      <div className="panel-heading">
        <h2>保存した計算</h2>
        <div className="actions">
          <button disabled={!history.length} onClick={exportHistory}>
            JSONで書き出す
          </button>
          <button disabled={!history.length} onClick={onClear}>
            すべて削除
          </button>
        </div>
      </div>
      <p className="helper">
        このブラウザーに最大50件保存。別の端末やブラウザーには同期されません。
      </p>
      {history.length ? (
        <div className="history-list">
          {history.map((r) => (
            <article key={r.id}>
              <div>
                <span className="muted">
                  {new Date(r.createdAt).toLocaleString("ja-JP")} ·{" "}
                  {r.mode === "inverse" ? "％から逆算" : "ダメージ計算"}
                </span>
                <h3>
                  {r.config.attacker.name} → {r.config.defender.name}
                </h3>
                <p>
                  {r.config.move} / {r.summary}
                </p>
              </div>
              <div className="actions">
                <button className="secondary" onClick={() => onRestore(r)}>
                  条件を復元
                </button>
                <button onClick={() => onRemove(r.id)}>削除</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-message">
          <Icon name="history" />
          <h3>まだ保存した計算はありません</h3>
          <p>計算結果の「履歴に保存」から追加できます。</p>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [mode, setMode] = useState("calc");
  const [config, setConfig] = useState(defaultConfig);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [result, setResult] = useState(() => calculateOne(defaultConfig()));
  const [comparison, setComparison] = useState(null);
  const [compareError, setCompareError] = useState("");
  const [calculatedConfig, setCalculatedConfig] = useState(defaultConfig);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [observations, setObservations] = useState([]);
  const [inference, setInference] = useState(null);
  const [inverseSnapshot, setInverseSnapshot] = useState("");
  const [progress, setProgress] = useState(null);
  const [history, setHistory] = useState(loadHistory);
  const [showCompare, setShowCompare] = useState(false);
  const workerRef = useRef(null);
  const resultRef = useRef(null);
  useEffect(() => () => workerRef.current?.terminate(), []);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const dirty = JSON.stringify(config) !== JSON.stringify(calculatedConfig);
  const inverseDirty =
    JSON.stringify({ config, observations }) !== inverseSnapshot;
  function updateConfig(c) {
    workerRef.current?.terminate();
    workerRef.current = null;
    setProgress(null);
    setConfig(c);
    setError("");
  }
  function updateObservations(o) {
    workerRef.current?.terminate();
    workerRef.current = null;
    setProgress(null);
    setObservations(o);
    setError("");
  }
  function compute() {
    setError("");
    try {
      setResult(calculateOne(config));
      setCalculatedConfig(structuredClone(config));
      setComparison(null);
      setCompareError("");
      if (showCompare) computeComparison(config);
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        }),
      );
    } catch (e) {
      setError(e.message);
    }
  }
  function computeComparison(c = config) {
    try {
      setComparison(compareExtremes(c));
      setCompareError("");
    } catch (e) {
      setComparison(null);
      setCompareError(e.message);
    }
  }
  function runInverse() {
    setError("");
    workerRef.current?.terminate();
    setProgress(0);
    const w = new Worker(new URL("./inference.worker.mjs", import.meta.url), {
      type: "module",
    });
    workerRef.current = w;
    w.onmessage = ({ data: message }) => {
      if (message.type === "progress") setProgress(message.value);
      if (message.type === "error") {
        setError(message.message);
        setProgress(null);
        w.terminate();
        workerRef.current = null;
      }
      if (message.type === "result") {
        setInference(message.result);
        setInverseSnapshot(JSON.stringify({ config, observations }));
        setProgress(null);
        w.terminate();
        workerRef.current = null;
        requestAnimationFrame(() =>
          resultRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          }),
        );
      }
    };
    w.onerror = () => {
      setError(
        "探索処理を読み込めませんでした。再読み込みしてお試しください。",
      );
      setProgress(null);
      w.terminate();
      workerRef.current = null;
    };
    w.postMessage({ config, observations });
  }
  function persist(next) {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setHistory(next);
      return true;
    } catch {
      setError(
        "ブラウザーの保存領域に書き込めません。保存設定や空き容量を確認してください。",
      );
      return false;
    }
  }
  function save() {
    const inverse = mode === "inverse";
    const snapshot = inverse
      ? JSON.parse(inverseSnapshot)
      : { config: calculatedConfig, observations: [] };
    const record = {
      version: 1,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      mode,
      config: snapshot.config,
      observations: snapshot.observations,
      summary: inverse
        ? `${inference.total}候補`
        : `${result.low}–${result.high} / ${pct(result.lowPercent)}–${pct(result.highPercent)}％`,
    };
    if (persist([record, ...history].slice(0, 50)))
      setNotice("計算条件と結果を履歴に保存しました。");
  }
  function restore(r) {
    updateConfig(structuredClone(r.config));
    setObservations(r.observations || []);
    setMode(r.mode);
    setAvailableOnly(false);
    setResult(null);
    setComparison(null);
    setInference(null);
    setNotice("条件を復元しました。計算ボタンで最新の結果を確認できます。");
  }
  const moves = useMemo(
    () => data.moves.filter((m) => m.category !== "Status"),
    [],
  );
  const moveSource = generation.moves.get(
    toID(find("moves", config.move)?.en || ""),
  );
  const hitRange = moveSource?.multihit;
  const hitOptions = Array.isArray(hitRange)
    ? Array.from(
        { length: hitRange[1] - hitRange[0] + 1 },
        (_, i) => hitRange[0] + i,
      )
    : [hitRange || 1];
  function updateSide(role, side) {
    const c = { ...config, [role]: side };
    if (side.ability !== config[role].ability) {
      const weather = {
        ひでり: "Sun",
        あめふらし: "Rain",
        すなおこし: "Sand",
        ゆきふらし: "Snow",
        おわりのだいち: "Harsh Sunshine",
        はじまりのうみ: "Heavy Rain",
        デルタストリーム: "Strong Winds",
      }[side.ability];
      const terrain = {
        エレキメイカー: "Electric",
        グラスメイカー: "Grassy",
        サイコメイカー: "Psychic",
        ミストメイカー: "Misty",
      }[side.ability];
      if (weather) c.weather = weather;
      if (terrain) c.terrain = terrain;
    }
    updateConfig(c);
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setMode("calc");
          }}
        >
          <Icon name="logo" />
          <span>
            CHAMPIONS
            <br />
            DAMAGE LAB
          </span>
        </a>
        <nav aria-label="メインメニュー">
          {[
            { id: "calc", icon: "calc", name: "ダメージ計算" },
            { id: "inverse", icon: "percent", name: "％から逆算" },
            { id: "history", icon: "history", name: "計算履歴" },
            { id: "ranking", icon: "calc", name: "ランキング" },
          ].map((t) => (
            <button
              key={t.id}
              className={mode === t.id ? "active" : ""}
              aria-current={mode === t.id ? "page" : undefined}
              onClick={() => {
                setMode(t.id);
                setError("");
              }}
            >
              <Icon name={t.icon} />
              <span>{t.name}</span>
              {t.id === "history" && history.length > 0 && (
                <small>{history.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          LV.50 / SINGLES
          <br />
          <span>非公式ダメージ計算ツール</span>
        </div>
      </aside>
      <main>
        <header className="page-header">
          <div>
            <h1>
              {mode === "calc"
                ? "ダメージ計算"
                : mode === "inverse"
                  ? "％から逆算"
                  : mode === "ranking"
                    ? "ランキング"
                    : "計算履歴"}
            </h1>
            <p>
              {mode === "history"
                ? "保存した条件を、もう一度。"
                : "LV.50・シングルバトル"}
            </p>
          </div>
          {mode !== "history" && mode !== "ranking" && (
            <Check
              label="使用可能のみ"
              checked={availableOnly}
              onChange={setAvailableOnly}
            />
          )}
        </header>
        {notice && (
          <div className="toast" role="status">
            {notice}
          </div>
        )}
        {mode === "ranking" ? (
          <Ranking />
        ) : mode === "history" ? (
          <History
            history={history}
            onRestore={restore}
            onRemove={(id) => persist(history.filter((r) => r.id !== id))}
            onClear={() => {
              if (window.confirm("保存した計算履歴をすべて削除しますか？"))
                persist([]);
            }}
          />
        ) : (
          <>
            <div className="pokemon-pair">
              <PokemonPanel
                side={config.attacker}
                role="attacker"
                onChange={(s) => updateSide("attacker", s)}
                availableOnly={availableOnly}
                inverse={mode === "inverse"}
              />
              <PokemonPanel
                side={config.defender}
                role="defender"
                onChange={(s) => updateSide("defender", s)}
                availableOnly={availableOnly}
                inverse={mode === "inverse"}
              />
            </div>
            <section className="panel battle-bar">
              <SearchField
                label="技"
                id="move"
                value={config.move}
                onChange={(v) => {
                  const hits = generation.moves.get(
                    toID(find("moves", v)?.en || ""),
                  )?.multihit;
                  updateConfig({
                    ...config,
                    move: v,
                    hits: Array.isArray(hits)
                      ? Math.max(hits[0], Math.min(hits[1], config.hits))
                      : hits || 1,
                  });
                }}
                options={moves}
              />
              <SelectField
                label="天候"
                value={config.weather}
                onChange={(v) => updateConfig({ ...config, weather: v })}
                options={[
                  { value: "", label: "なし" },
                  { value: "Sun", label: "にほんばれ" },
                  { value: "Rain", label: "あめ" },
                  { value: "Sand", label: "すなあらし" },
                  { value: "Snow", label: "ゆき" },
                  { value: "Harsh Sunshine", label: "おおひでり" },
                  { value: "Heavy Rain", label: "おおあめ" },
                  { value: "Strong Winds", label: "らんきりゅう" },
                ]}
              />
              <SelectField
                label="フィールド"
                value={config.terrain}
                onChange={(v) => updateConfig({ ...config, terrain: v })}
                options={[
                  { value: "", label: "なし" },
                  { value: "Electric", label: "エレキ" },
                  { value: "Grassy", label: "グラス" },
                  { value: "Psychic", label: "サイコ" },
                  { value: "Misty", label: "ミスト" },
                ]}
              />
              {mode === "calc" ? (
                <button className="primary" onClick={compute}>
                  計算する
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={progress !== null || !observations.length}
                  onClick={runInverse}
                >
                  {progress !== null ? `探索中 ${progress}％` : "候補を探索"}
                </button>
              )}
            </section>
            <div className="move-info">
              <span>
                {find("moves", config.move)?.typeLabel} /{" "}
                {find("moves", config.move)?.category === "Physical"
                  ? "物理"
                  : "特殊"}{" "}
                / 威力 {find("moves", config.move)?.power ?? "条件依存"}
              </span>
              <label>
                連続技のヒット数{" "}
                <select
                  aria-label="連続技のヒット数"
                  disabled={hitOptions.length === 1}
                  value={hitOptions.length === 1 ? hitOptions[0] : config.hits}
                  onChange={(e) =>
                    updateConfig({ ...config, hits: Number(e.target.value) })
                  }
                >
                  {hitOptions.map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              </label>
              <button
                className="text-button"
                onClick={() => {
                  updateConfig({
                    ...config,
                    attacker: config.defender,
                    defender: config.attacker,
                  });
                }}
              >
                攻撃側と防御側を入れ替え
              </button>
            </div>
            <Details config={config} setConfig={updateConfig} />
            {mode === "inverse" && (
              <Observations
                observations={observations}
                setObservations={updateObservations}
              />
            )}
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            {progress !== null && (
              <div className="panel progress-panel" role="status">
                <progress max="100" value={progress} />
                <span>候補を探索しています… {progress}％</span>
                <button
                  onClick={() => {
                    workerRef.current?.terminate();
                    workerRef.current = null;
                    setProgress(null);
                  }}
                >
                  中止
                </button>
              </div>
            )}
            <div ref={resultRef} className="result-anchor" />
            {mode === "calc" && result && (
              <>
                <div className="result-toolbar">
                  <div className="segment">
                    <button
                      className={!showCompare ? "active" : ""}
                      onClick={() => setShowCompare(false)}
                    >
                      手動設定
                    </button>
                    <button
                      className={showCompare ? "active" : ""}
                      onClick={() => {
                        setShowCompare(true);
                        computeComparison(calculatedConfig);
                      }}
                    >
                      最小・最大72通り
                    </button>
                  </div>
                  {dirty && (
                    <span className="stale" role="status">
                      条件が変更されています。再計算してください。
                    </span>
                  )}
                </div>
                <div className={dirty ? "stale-result" : ""}>
                  <Result
                    result={result}
                    config={calculatedConfig}
                    onSave={save}
                  />
                  {showCompare && (
                    <Comparison
                      comparison={comparison}
                      compareError={compareError}
                    />
                  )}
                </div>
              </>
            )}
            {mode === "inverse" && inference && (
              <>
                {inverseDirty && (
                  <p className="stale">
                    条件が変更されています。再度探索してください。
                  </p>
                )}
                <InferenceResult result={inference} onSave={save} />
              </>
            )}
            {mode === "inverse" && !inference && (
              <div className="panel method-note">
                <h2>整数％から、成立する配分を探す</h2>
                <p>
                  攻撃側の条件を指定し、相手のHP表示を記録してください。残り73％なら73％以上74％未満となるHPを調べ、合計66ポイント以内の候補を表示します。
                </p>
                <p className="helper">
                  探索対象はHP・対象の防御能力・性格補正。特性・持ち物・その他の能力は指定値が前提です。連続技、カウンター系、一撃必殺技など一部の特殊条件は対象外です。
                </p>
              </div>
            )}
          </>
        )}
        <footer>
          <span>CSVデータ · Champions専用計算エンジン</span>
          <details>
            <summary>計算範囲・データについて</summary>
            <p>
              提供CSVをもとに計算しています。技の習得可否は検証しません。タイプ・威力・種族値・接触／音／切る等の分類はCSV、個別効果は同梱したSmogon計算エンジンを参照します。
            </p>
            <p>
              HP表示は整数切り捨て、生存中は最低1％、ひんしは0％として扱います。結果は技を受けた直後のダメージで、きのみの回復・反動・天候などによる攻撃後のHP変化は逆算に含めません。固定ヒット数の連続技を含め、技が命中する前提です。
            </p>
            <p>
              使用可能リスト外は参考計算です。未対応データ・特殊技は結果を出さず案内します。全ケースの実機一致を保証するものではありません。
            </p>
            <p>
              © Pokémon / Nintendo / Creatures / GAME
              FREAK。非公式ツール。計算処理：Smogon
              damage-calc（MIT）、名称対応：PokeAPI。
              <a href="/licenses/smogon.txt" target="_blank" rel="noreferrer">
                計算エンジンのライセンス
              </a>
              {" / "}
              <a href="/licenses/pokeapi.txt" target="_blank" rel="noreferrer">
                名称データのライセンス
              </a>
            </p>
          </details>
        </footer>
      </main>
    </div>
  );
}
