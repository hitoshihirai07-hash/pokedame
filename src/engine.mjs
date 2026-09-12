import {
  Generations,
  Pokemon,
  Move,
  Field,
  calculate,
  toID,
} from "../vendor/calc.js";
import DATA from "./generated/data.json" with { type: "json" };

export const data = DATA;
export const STATS = ["hp", "atk", "def", "spa", "spd", "spe"];
export const LABELS = {
  hp: "HP",
  atk: "攻撃",
  def: "防御",
  spa: "特攻",
  spd: "特防",
  spe: "素早さ",
};
export const zeroPoints = () => Object.fromEntries(STATS.map((k) => [k, 0]));
const current = Generations.get(0),
  previous = Generations.get(9);
// Gen 0 mechanics, with archived species/moves available for the user-requested all filter.
export const generation = { ...current };
for (const key of ["species", "moves", "items", "abilities"])
  generation[key] = {
    get: (id) => current[key].get(id) || previous[key].get(id),
    *[Symbol.iterator]() {
      yield* new Map(
        [...previous[key], ...current[key]].map((x) => [x.id, x]),
      ).values();
    },
  };
const indexes = Object.fromEntries(
  ["pokemon", "moves", "abilities", "items", "natures"].map((k) => [
    k,
    new Map(data[k].map((x) => [x.name, x])),
  ]),
);
export const find = (kind, name) => indexes[kind].get(name);
export function defaultSide(name) {
  return {
    name,
    ability: find("pokemon", name)?.abilities[0] || "",
    item: "",
    nature: "まじめ",
    points: zeroPoints(),
    boosts: zeroPoints(),
    hpPercent: 100,
    status: "",
    abilityOn: true,
    alliesFainted: 0,
  };
}
export function defaultConfig() {
  return {
    attacker: {
      ...defaultSide("ガブリアス"),
      nature: "いじっぱり",
      points: { ...zeroPoints(), atk: 32, spe: 32, hp: 2 },
    },
    defender: {
      ...defaultSide("サーフゴー"),
      points: { ...zeroPoints(), hp: 32, def: 32, spd: 2 },
    },
    move: "じしん",
    weather: "",
    terrain: "",
    critical: false,
    hits: 3,
    reflect: false,
    lightScreen: false,
    auroraVeil: false,
    protected: false,
    gravity: false,
    wonderRoom: false,
    magicRoom: false,
  };
}
export class CalculationError extends Error {}
function required(kind, name) {
  const r = find(kind, name);
  if (!r)
    throw new CalculationError(`${name || "未選択"}を選び直してください。`);
  return r;
}
export function validateSide(side) {
  required("pokemon", side.name);
  const pts = STATS.map((k) => Number(side.points[k]));
  if (pts.some((x) => !Number.isInteger(x) || x < 0 || x > 32))
    throw new CalculationError(
      "能力ポイントは各0～32の整数で指定してください。",
    );
  if (pts.reduce((a, b) => a + b, 0) > 66)
    throw new CalculationError(
      `${side.name}の能力ポイント合計が66を超えています。`,
    );
  if (
    !Number.isFinite(Number(side.hpPercent)) ||
    side.hpPercent < 1 ||
    side.hpPercent > 100
  )
    throw new CalculationError("現在HPは1～100％で指定してください。");
  if (
    STATS.some(
      (k) =>
        !Number.isInteger(Number(side.boosts[k] || 0)) ||
        Math.abs(side.boosts[k] || 0) > 6,
    )
  )
    throw new CalculationError("能力ランクは−6～＋6の整数で指定してください。");
  if (
    !Number.isInteger(Number(side.alliesFainted || 0)) ||
    side.alliesFainted < 0 ||
    side.alliesFainted > 5
  )
    throw new CalculationError("ひんしの味方は0～5体で指定してください。");
}
function resolvedAbility(side, p) {
  let en = side.ability ? required("abilities", side.ability).en : "";
  if (side.ability === "じんばいったい")
    en = p.en?.includes("Shadow") ? "As One (Spectrier)" : "As One (Glastrier)";
  if (side.ability === "おもかげやどし")
    en = `Embody Aspect (${p.en?.includes("Hearthflame") ? "Hearthflame" : p.en?.includes("Wellspring") ? "Wellspring" : p.en?.includes("Cornerstone") ? "Cornerstone" : "Teal"})`;
  if (side.ability && !en)
    throw new CalculationError(`${side.ability}は計算未対応です。`);
  return en;
}
export function buildPokemon(side, curHP) {
  validateSide(side);
  const p = required("pokemon", side.name);
  if (!p.en)
    throw new CalculationError(
      `${p.name}はエンジンの対応待ちです。通常形態で確認してください。`,
    );
  const item = side.item ? required("items", side.item) : null;
  if (item && !item.en)
    throw new CalculationError(
      `${item.name}は計算エンジンとの名称対応が未確認です。`,
    );
  const ability = resolvedAbility(side, p);
  const nature = required("natures", side.nature).en;
  const pokemon = new Pokemon(generation, p.en, {
    level: 50,
    ability: ability || "No Ability",
    abilityOn: side.abilityOn,
    item: item?.en || "",
    nature,
    evs: side.points,
    boosts: side.boosts,
    status: side.status || "",
    alliesFainted: Number(side.alliesFainted || 0),
    overrides: {
      baseStats: p.baseStats,
      types: p.types,
      weightkg: p.weightkg,
      nfe: p.nfe,
      abilities: { 0: ability || "No Ability" },
    },
  });
  pokemon.originalCurHP =
    curHP ??
    Math.max(1, Math.floor((pokemon.maxHP() * Number(side.hpPercent)) / 100));
  return pokemon;
}
const unsupportedMoves = new Set([
  "Counter",
  "Mirror Coat",
  "Metal Burst",
  "Comeuppance",
  "Fissure",
  "Guillotine",
  "Horn Drill",
  "Sheer Cold",
  "Bide",
  "Beat Up",
  "Spit Up",
]);
export function buildMove(config, attacker) {
  const row = required("moves", config.move);
  if (!row.en)
    throw new CalculationError(`${row.name}は計算エンジンの対応待ちです。`);
  if (row.category === "Status")
    throw new CalculationError(
      "変化技はダメージ比較の対象外です。攻撃技を選択してください。",
    );
  if (unsupportedMoves.has(row.en))
    throw new CalculationError(
      `${row.name}は過去の被ダメージ・味方の構成など追加条件が必要なため、この版では計算対象外です。`,
    );
  const source = generation.moves.get(toID(row.en));
  if (
    Array.isArray(source?.multihit) &&
    (!Number.isInteger(Number(config.hits)) ||
      config.hits < source.multihit[0] ||
      config.hits > source.multihit[1])
  )
    throw new CalculationError(
      `この技のヒット数は${source.multihit[0]}～${source.multihit[1]}で指定してください。`,
    );
  const overrides = {
    type: row.type,
    category: row.category,
    flags: row.flags,
  };
  if (row.power !== null) overrides.basePower = row.power;
  if (row.alwaysCrit) overrides.willCrit = true;
  return new Move(generation, row.en, {
    isCrit: !!config.critical,
    hits: Number(config.hits),
    ability: attacker.ability,
    item: attacker.item,
    overrides,
  });
}
export function moveAxes(config) {
  const attacker = buildPokemon(config.attacker),
    m = buildMove(config, attacker);
  let defense =
    m.overrideDefensiveStat || (m.category === "Physical" ? "def" : "spd");
  if (config.wonderRoom) defense = defense === "def" ? "spd" : "def";
  return {
    attack:
      m.overrideOffensiveStat || (m.category === "Physical" ? "atk" : "spa"),
    defense,
    source: m.overrideOffensivePokemon === "target" ? "defender" : "attacker",
  };
}
function field(config) {
  return new Field({
    gameType: "Singles",
    weather: config.weather || undefined,
    terrain: config.terrain || undefined,
    isGravity: !!config.gravity,
    isWonderRoom: !!config.wonderRoom,
    isMagicRoom: !!config.magicRoom,
    defenderSide: {
      isReflect: !!config.reflect,
      isLightScreen: !!config.lightScreen,
      isAuroraVeil: !!config.auroraVeil,
      isProtected: !!config.protected,
    },
  });
}
export function damageDistribution(damage) {
  let components =
    typeof damage === "number"
      ? [[damage]]
      : Array.isArray(damage[0])
        ? damage
        : damage.length < 16
          ? damage.map((d) => [d])
          : [damage];
  let dist = new Map([[0, 1]]);
  for (const component of components) {
    const next = new Map();
    for (const [sum, p] of dist)
      for (const d of component)
        next.set(sum + d, (next.get(sum + d) || 0) + p / component.length);
    dist = next;
  }
  return [...dist]
    .sort((a, b) => a[0] - b[0])
    .map(([damage, probability]) => ({ damage, probability }));
}
export function calculateRaw(config, curHP) {
  const a = buildPokemon(config.attacker),
    d = buildPokemon(config.defender, curHP),
    m = buildMove(config, a);
  const shield =
    d.hasAbility("Disguise", "Ice Face") && config.defender.abilityOn;
  if (shield && m.hits > 1)
    throw new CalculationError(
      "ばけのかわ・アイスフェイス発動中の連続技は未対応です。解除後は「特性の発動条件」をOFFにしてください。",
    );
  const result = calculate(generation, a, d, m, field(config));
  if (
    shield &&
    result.defender.hasAbility("Disguise", "Ice Face") &&
    Number(result.range()[1]) > 0 &&
    (d.hasAbility("Disguise") || result.move.category === "Physical")
  ) {
    result.damage = d.hasAbility("Disguise") ? Math.floor(d.maxHP() / 8) : 0;
  }
  return { result, a, d, m };
}
export function calculateOne(config) {
  const { result, a, d, m } = calculateRaw(config);
  const distribution = damageDistribution(result.damage);
  const low = distribution[0].damage,
    high = distribution.at(-1).damage;
  const sash =
    d.curHP() === d.maxHP() &&
    (result.defender.hasItem("Focus Sash") ||
      result.defender.hasAbility("Sturdy")) &&
    m.hits === 1 &&
    !a.hasAbility("Parental Bond");
  const ko = sash
    ? 0
    : distribution
        .filter((r) => r.damage >= d.curHP())
        .reduce((s, r) => s + r.probability, 0);
  return {
    low,
    high,
    lowPercent: (low / d.maxHP()) * 100,
    highPercent: (high / d.maxHP()) * 100,
    hp: d.maxHP(),
    currentHp: d.curHP(),
    distribution,
    rolls:
      typeof result.damage === "number"
        ? [result.damage]
        : !Array.isArray(result.damage[0]) && result.damage.length === 16
          ? result.damage
          : null,
    hits: m.hits,
    ko,
    attackStats: a.rawStats,
    defenseStats: d.rawStats,
    description: result.rawDesc,
    warnings: [
      ...(!find("pokemon", config.attacker.name).available ||
      !find("pokemon", config.defender.name).available
        ? ["使用可能リスト外を含む参考計算です。"]
        : []),
      ...(!find("moves", config.move).engineAvailable
        ? [
            "この技はChampionsの収録技として未確認です。過去作のデータで参考計算しています。",
          ]
        : []),
      ...(sash
        ? [
            "満タン時のきあいのタスキ／がんじょうを考慮し、単発技の撃破率を0％としています。",
          ]
        : []),
      ...(d.hasAbility("Disguise") && config.defender.abilityOn
        ? ["ばけのかわ発動時のHP減少を表示しています。"]
        : []),
    ],
  };
}
function natureFor(stat, mult) {
  if (mult === 1) return "まじめ";
  return data.natures.find((n) =>
    mult === 1.1 ? n.plus === stat : n.minus === stat,
  ).name;
}
export function compareExtremes(config) {
  const axes = moveAxes(config);
  if (axes.source === "defender")
    throw new CalculationError(
      "相手の攻撃を参照する技は手動設定で計算してください。",
    );
  if (
    [
      "Shell Side Arm",
      "Photon Geyser",
      "Tera Blast",
      "Tera Starstorm",
    ].includes(find("moves", config.move).en)
  )
    throw new CalculationError(
      "参照能力が条件で変わる技は手動設定で計算してください。",
    );
  const rows = [];
  for (const ap of [0, 32])
    for (const am of [1.1, 1, 0.9])
      for (const hp of [0, 32])
        for (const dp of [0, 32])
          for (const dm of [1.1, 1, 0.9]) {
            const c = structuredClone(config);
            // All non-axis points are reset so every comparison is a legal 0–66 spread.
            c.attacker.points = { ...zeroPoints(), [axes.attack]: ap };
            c.defender.points = { ...zeroPoints(), hp, [axes.defense]: dp };
            c.attacker.nature = natureFor(axes.attack, am);
            c.defender.nature = natureFor(axes.defense, dm);
            const result = calculateOne(c);
            rows.push({
              id: rows.length,
              ap,
              am,
              hpPoint: hp,
              dp,
              dm,
              ...result,
            });
          }
  return { axes, rows };
}

export function displayPercent(hp, maxHP) {
  return hp <= 0 ? 0 : Math.max(1, Math.floor((100 * hp) / maxHP));
}
export function hpBounds(percent, maxHP) {
  if (percent === 0) return [0, 0];
  if (percent === 100) return [maxHP, maxHP];
  // Live Pokémon display a minimum of 1%, per the supplied 1–100% display rule.
  return [
    percent === 1 ? 1 : Math.ceil((percent * maxHP) / 100),
    Math.min(maxHP, Math.ceil(((percent + 1) * maxHP) / 100) - 1),
  ];
}
export function validateObservations(observations) {
  if (!observations.length)
    throw new CalculationError("ダメージ記録を1件以上入力してください。");
  for (const o of observations) {
    if (
      !Number.isInteger(o.before) ||
      !Number.isInteger(o.after) ||
      o.before < 1 ||
      o.before > 100 ||
      o.after < 0 ||
      o.after > 100 ||
      o.after > o.before
    )
      throw new CalculationError(
        "攻撃前は1～100％、攻撃後は0～攻撃前の整数で指定してください。",
      );
  }
}
export function inferCandidates(config, observations, onProgress = () => {}) {
  validateObservations(observations);
  const axes = moveAxes(config),
    move = find("moves", config.move);
  if (
    axes.source === "defender" ||
    [
      "Shell Side Arm",
      "Photon Geyser",
      "Tera Blast",
      "Tera Starstorm",
    ].includes(move.en)
  )
    throw new CalculationError(
      "この技は複数の未確定能力を参照するため、％逆算は未対応です。手動設定で比較してください。",
    );
  const base = calculateRaw(config);
  if (base.m.hits > 1 || base.a.hasAbility("Parental Bond"))
    throw new CalculationError(
      "連続技の％逆算は未対応です。単発技を選択してください。基本計算では連続技を利用できます。",
    );
  const candidates = [];
  const groups = new Map();
  const fixed = STATS.filter((k) => k !== "hp" && k !== axes.defense).reduce(
    (sum, k) => sum + Number(config.defender.points[k]),
    0,
  );
  for (let hp = 0; hp <= 32; hp++) {
    for (let dp = 0; dp <= 32; dp++) {
      if (hp + dp + fixed > 66) continue;
      const c = structuredClone(config);
      c.defender.points = { ...c.defender.points, hp, [axes.defense]: dp };
      const relevant = new Set([axes.defense]);
      if (["Gyro Ball", "Electro Ball"].includes(move.en)) relevant.add("spe");
      if (config.wonderRoom)
        relevant.add(axes.defense === "def" ? "spd" : "def");
      if (["こだいかっせい", "クォークチャージ"].includes(c.defender.ability))
        for (const stat of STATS) relevant.add(stat);
      const natureGroups = new Map();
      for (const nature of data.natures) {
        c.defender.nature = nature.name;
        const raw = buildPokemon(c.defender).rawStats;
        const key = JSON.stringify([...relevant].map((k) => raw[k]));
        if (!natureGroups.has(key)) natureGroups.set(key, []);
        natureGroups.get(key).push(nature);
      }
      for (const natures of natureGroups.values()) {
        c.defender.nature = natures[0].name;
        const mult =
          natures[0].plus === axes.defense
            ? 1.1
            : natures[0].minus === axes.defense
              ? 0.9
              : 1;
        const p = buildPokemon(c.defender),
          max = p.maxHP();
        const counts = [];
        let accepted = true;
        let sample;
        for (const observation of observations) {
          const [lo, hi] = hpBounds(observation.before, max);
          const matching = new Set();
          let denominator = 16;
          for (let beforeHP = lo; beforeHP <= hi; beforeHP++) {
            const { result, a, d, m } = calculateRaw(c, beforeHP);
            const rolls =
              typeof result.damage === "number"
                ? [result.damage]
                : result.damage;
            denominator = rolls.length;
            if (!sample)
              sample = { low: Math.min(...rolls), high: Math.max(...rolls) };
            for (let i = 0; i < rolls.length; i++) {
              let afterHP = Math.max(0, beforeHP - rolls[i]);
              if (
                afterHP === 0 &&
                beforeHP === max &&
                m.hits === 1 &&
                (result.defender.hasItem("Focus Sash") ||
                  result.defender.hasAbility("Sturdy"))
              )
                afterHP = 1;
              if (displayPercent(afterHP, max) === observation.after)
                matching.add(i);
            }
          }
          if (!matching.size) {
            accepted = false;
            break;
          }
          counts.push({ matched: matching.size, total: denominator });
        }
        if (!accepted) continue;
        const score = counts.reduce((p, c) => (p * c.matched) / c.total, 1);
        const candidate = {
          hp,
          dp,
          mult,
          maxHP: max,
          defense: p.rawStats[axes.defense],
          counts,
          score,
          ...sample,
        };
        candidates.push(candidate);
        const key = JSON.stringify([
          candidate.maxHP,
          candidate.defense,
          candidate.counts,
          candidate.low,
          candidate.high,
        ]);
        if (!groups.has(key)) groups.set(key, { ...candidate, variants: [] });
        groups
          .get(key)
          .variants.push({ hp, dp, mult, natures: natures.map((n) => n.name) });
      }
    }
    onProgress(Math.round(((hp + 1) / 33) * 100));
  }
  return {
    axes,
    total: candidates.length,
    groups: [...groups.values()].sort(
      (a, b) => b.score - a.score || a.maxHP - b.maxHP || a.defense - b.defense,
    ),
    observations,
  };
}
