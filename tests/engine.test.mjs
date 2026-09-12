import test from "node:test";
import assert from "node:assert/strict";
import {
  data,
  find,
  defaultSide,
  defaultConfig,
  zeroPoints,
  buildPokemon,
  calculateOne,
  calculateRaw,
  compareExtremes,
  displayPercent,
  hpBounds,
  inferCandidates,
  damageDistribution,
} from "../src/engine.mjs";

function pair(
  attacker = "ガブリアス",
  defender = "サーフゴー",
  move = "じしん",
) {
  return {
    ...defaultConfig(),
    attacker: { ...defaultSide(attacker), ability: "" },
    defender: { ...defaultSide(defender), ability: "" },
    move,
  };
}
test("Champions stats: points add one before nature; fixed LV50 and total 66 enforced", () => {
  const s = defaultSide("ガブリアス");
  let p = buildPokemon(s);
  assert.equal(p.level, 50);
  assert.equal(p.rawStats.hp, 183);
  assert.equal(p.rawStats.atk, 150);
  s.points.atk = 32;
  s.nature = "いじっぱり";
  p = buildPokemon(s);
  assert.equal(p.rawStats.atk, 200);
  s.points.hp = 32;
  s.points.def = 3;
  assert.throws(() => buildPokemon(s), /66/);
  s.points.def = -1;
  assert.throws(() => buildPokemon(s), /0～32/);
});
test("independently worked LV50 earthquake case preserves all 16 rounding outcomes", () => {
  const c = defaultConfig(),
    r = calculateOne(c);
  // A=200, D=147 => floor(floor(22*100*200/147)/50)+2=61.
  // Apply floor(base*r/100), floor(STAB 1.5), then effectiveness 2.
  const expected = Array.from(
    { length: 16 },
    (_, i) => Math.floor(Math.floor((61 * (85 + i)) / 100) * 1.5) * 2,
  );
  assert.deepEqual(r.rolls, expected);
  assert.equal(r.low, 152);
  assert.equal(r.high, 182);
  assert.equal(r.hp, 194);
});
test("72 legal extreme rows retain 0/32 HP points separately from HP stats", () => {
  const result = compareExtremes(defaultConfig());
  assert.equal(result.rows.length, 72);
  assert.deepEqual([...new Set(result.rows.map((r) => r.hpPoint))], [0, 32]);
  assert.deepEqual([...new Set(result.rows.map((r) => r.am))], [1.1, 1, 0.9]);
  assert(
    result.rows.every((r) => r.hp === 162 + r.hpPoint && r.rolls.length === 16),
  );
});
test("type immunity and Mold Breaker over Levitate", () => {
  const c = pair("ガブリアス", "ゲンガー", "たいあたり");
  assert.equal(calculateOne(c).high, 0);
  c.move = "じしん";
  c.defender = defaultSide("ロトム");
  assert.equal(calculateOne(c).high, 0);
  c.attacker.ability = "かたやぶり";
  assert(calculateOne(c).high > 0);
});
test("CSV contact, sound and slicing flags drive respective abilities", () => {
  assert.equal(find("moves", "たいあたり").flags.contact, 1);
  assert.equal(find("moves", "リーフブレード").flags.slicing, 1);
  const c = pair("エルレイド", "カビゴン", "リーフブレード");
  let raw = calculateOne(c).high;
  c.attacker.ability = "きれあじ";
  assert(calculateOne(c).high > raw);
  c.move = "ハイパーボイス";
  c.defender.ability = "ぼうおん";
  assert.equal(calculateOne(c).high, 0);
  c.move = "たいあたり";
  c.attacker.ability = "";
  c.defender.ability = "";
  raw = calculateOne(c).high;
  c.defender.ability = "もふもふ";
  assert(calculateOne(c).high < raw);
});
test("items, burn, screens, critical hits and weather change damage", () => {
  const c = pair();
  const normal = calculateOne(c).high;
  c.attacker.item = "いのちのたま";
  assert(calculateOne(c).high > normal);
  c.attacker.item = "";
  c.attacker.status = "brn";
  assert(calculateOne(c).high < normal);
  c.attacker.status = "";
  c.reflect = true;
  assert(calculateOne(c).high < normal);
  c.critical = true;
  assert(calculateOne(c).high > normal);
  const fire = pair("リザードン", "カビゴン", "かえんほうしゃ");
  const dry = calculateOne(fire).high;
  fire.weather = "Rain";
  assert(calculateOne(fire).high < dry);
});
test("Mega Pokémon use actual form stats and ability, including new Mega abilities", () => {
  const normal = buildPokemon(defaultSide("ガブリアス")),
    mega = buildPokemon(defaultSide("メガガブリアス"));
  assert(mega.rawStats.atk > normal.rawStats.atk);
  assert.equal(mega.ability, "Sand Force");
  assert.equal(
    buildPokemon(defaultSide("メガカエンジシ")).ability,
    "Fire Mane",
  );
});
test("multihit damage uses independent convolution and sums to one", () => {
  assert.deepEqual(
    damageDistribution([
      [1, 2],
      [1, 2],
    ]),
    [
      { damage: 2, probability: 0.25 },
      { damage: 3, probability: 0.5 },
      { damage: 4, probability: 0.25 },
    ],
  );
  const c = pair("パルシェン", "カビゴン", "つららばり");
  c.hits = 5;
  const r = calculateOne(c);
  assert.equal(r.hits, 5);
  assert(
    Math.abs(r.distribution.reduce((s, x) => s + x.probability, 0) - 1) < 1e-9,
  );
  assert.equal(r.rolls, null);
  c.hits = 10;
  assert.throws(() => calculateOne(c), /ヒット数/);
});
test("HP percentage intervals exactly match every possible HP, including KO and minimum 1%", () => {
  for (const max of [1, 100, 101, 162, 194, 255, 362])
    for (let percent = 0; percent <= 100; percent++) {
      const [lo, hi] = hpBounds(percent, max);
      const expected = Array.from({ length: max + 1 }, (_, hp) => hp).filter(
        (hp) => displayPercent(hp, max) === percent,
      );
      const actual = Array.from(
        { length: Math.max(0, hi - lo + 1) },
        (_, i) => lo + i,
      );
      assert.deepEqual(actual, expected, `${max} / ${percent}`);
    }
  assert.deepEqual(hpBounds(73, 200), [146, 147]);
});
test("inverse retains true hidden spread for floor-rounded damage and multiple independent records", () => {
  const hidden = defaultConfig();
  hidden.defender.points = { ...zeroPoints(), hp: 17, def: 23, spd: 2 };
  hidden.defender.nature = "ずぶとい";
  const r = calculateOne(hidden);
  const first = {
    before: 100,
    after: displayPercent(Math.max(0, r.hp - r.rolls[3]), r.hp),
  };
  const second = {
    before: 100,
    after: displayPercent(Math.max(0, r.hp - r.rolls[12]), r.hp),
  };
  const input = defaultConfig();
  const once = inferCandidates(input, [first]);
  const both = inferCandidates(input, [first, second]);
  const actual = both.groups
    .flatMap((g) => g.variants)
    .find((v) => v.hp === 17 && v.dp === 23 && v.mult === 1.1);
  assert(actual);
  assert(actual.natures.includes("ずぶとい"));
  assert(both.total <= once.total);
});
test("inverse considers each pre-attack HP within the integer display interval", () => {
  const hidden = defaultConfig();
  hidden.defender.points = { ...zeroPoints(), hp: 21, def: 27, spd: 2 };
  hidden.defender.nature = "わんぱく";
  const max = buildPokemon(hidden.defender).maxHP();
  const [lo, hi] = hpBounds(93, max);
  assert(hi >= lo);
  const { result } = calculateRaw(hidden, hi);
  const obs = {
    before: 93,
    after: displayPercent(Math.max(0, hi - result.damage[0]), max),
  };
  const matches = inferCandidates(defaultConfig(), [obs]);
  assert(
    matches.groups.some((g) =>
      g.variants.some((v) => v.hp === 21 && v.dp === 27 && v.mult === 1.1),
    ),
  );
});
test("fixed damage, protection, full-health Multiscale, Focus Sash and Disguise", () => {
  const fixed = pair("ガブリアス", "カビゴン", "ちきゅうなげ");
  assert.equal(calculateOne(fixed).high, 50);
  fixed.protected = true;
  assert.equal(calculateOne(fixed).high, 0);
  const dragon = pair("ガブリアス", "カイリュー", "ドラゴンクロー");
  dragon.defender.ability = "マルチスケイル";
  const full = calculateOne(dragon).high;
  dragon.defender.hpPercent = 90;
  assert(calculateOne(dragon).high > full);
  const sash = pair("ガブリアス", "コイキング", "げきりん");
  sash.defender.item = "きあいのタスキ";
  assert.equal(calculateOne(sash).ko, 0);
  const disguise = pair("ガブリアス", "ミミッキュ", "じしん");
  disguise.defender.ability = "ばけのかわ";
  const blocked = calculateOne(disguise);
  assert.equal(blocked.high, Math.floor(blocked.hp / 8));
  disguise.defender.abilityOn = false;
  assert(calculateOne(disguise).high > blocked.high);
});
test("bad input and unsupported mechanics are visible errors, never plausible zeroes", () => {
  const c = defaultConfig();
  c.move = "存在しない技";
  assert.throws(() => calculateOne(c), /選び直し/);
  c.move = "カウンター";
  assert.throws(() => calculateOne(c), /対象外/);
  assert.throws(
    () => inferCandidates(defaultConfig(), [{ before: 73, after: 90 }]),
    /整数/,
  );
  assert.throws(() => inferCandidates(defaultConfig(), []), /1件/);
});
test("data integrity: unique names, 21 natures, mapped available Pokémon and all items", () => {
  for (const key of ["pokemon", "moves", "abilities", "items", "natures"])
    assert.equal(
      new Set(data[key].map((r) => r.name)).size,
      data[key].length,
      `${key} duplicate`,
    );
  assert.equal(data.natures.length, 21);
  assert(data.pokemon.filter((p) => p.available).every((p) => p.en));
  assert(data.items.every((i) => i.en));
  assert.equal(find("pokemon", "メガボスゴドラ").types.length, 1);
  assert.equal(find("pokemon", "ウインディH").baseStats.def, 80);
});
