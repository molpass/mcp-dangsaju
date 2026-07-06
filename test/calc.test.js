// calc.test.js — 당사주 작괘·데이터 무결성 픽스처 (지시서 §6, R0 재판정 반영).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import KoreanLunarCalendar from "korean-lunar-calendar";
import { BRANCHES, mod12, yearBranchIndex, hourBranch, makeChart } from "../src/calc.js";
import { normalizeBirth, solarToLunar, lunarToSolar } from "../src/lunar.js";

const KLC = KoreanLunarCalendar.default || KoreanLunarCalendar;
const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const RAW = JSON.parse(readFileSync(join(dataDir, "dangsaju_12stars.json"), "utf8"));

const BRANCHES_HANJA = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
// 데이터를 jiji 한자로 인덱싱 (키 스킴·_meta 유무에 견고). STARS[i] = 지지 인덱스 i의 별.
const ENTRIES = Object.values(RAW).filter((e) => e && e.jiji);
const STARS = BRANCHES_HANJA.map((h) => ENTRIES.find((x) => x.jiji.includes(h)));
const starAt = (i) => STARS[i].star;
const FWD = 1, BWD = -1;

// §6-1 1차 앵커 A (황룡사, 순행): 을축(丑)년 음9월12일 오시 → 액·인·고·권.
//   년성 丑천액 → 월성 酉천인 → 일성 申천고 → 시성 寅천권. (시수 午=7)
test("§6-1 앵커A: 을축 9/12 오시(순행) → 천액·천인·천고·천권", () => {
  const c = makeChart({ yearIndex: 1, lunarMonth: 9, lunarDay: 12, hourNumber: 7, dir: FWD });
  assert.deepEqual([c.year, c.month, c.day, c.hour], [1, 9, 8, 2]);
  assert.deepEqual([starAt(c.year), starAt(c.month), starAt(c.day), starAt(c.hour)],
    ["천액성", "천인성", "천고성", "천권성"]);
});

// §6-1 1차 앵커 B (황룡사, 순행): 갑인(寅)년 음7월26일 오시 → 권·고·인·파.
//   년성 寅천권 → 월성 申천고 → 일성 酉천인 → 시성 卯천파.
test("§6-1 앵커B: 갑인 7/26 오시(순행) → 천권·천고·천인·천파", () => {
  const c = makeChart({ yearIndex: 2, lunarMonth: 7, lunarDay: 26, hourNumber: 7, dir: FWD });
  assert.deepEqual([c.year, c.month, c.day, c.hour], [2, 8, 9, 3]);
  assert.deepEqual([starAt(c.year), starAt(c.month), starAt(c.day), starAt(c.hour)],
    ["천권성", "천고성", "천인성", "천파성"]);
});

// 변형 모드(남순여역) 앵커: 子(천귀)년 음3월 여자(역행) → 월성 戌 천예성. (soultest)
//   재현: 子⑴亥⑵戌⑶ (반시계 inclusive)
test("변형(역행) 앵커: 子년·음3월 여 → 월성 戌 천예성", () => {
  const c = makeChart({ yearIndex: 0, lunarMonth: 3, lunarDay: 1, hourNumber: null, dir: BWD });
  assert.equal(c.month, 10); // 술(戌)
  assert.equal(starAt(c.month), "천예성");
});

// 년지 산출: (연−4)%12 공식 = korean-lunar-calendar 간지 지지 (독립 교차검증).
test("년지 산출 = KLC 간지 교차검증", () => {
  for (const y of [1960, 1976, 1984, 2000, 2024]) {
    const c = new KLC();
    c.setLunarDate(y, 1, 1, false);
    const jijiHanja = c.getChineseGapja().year.match(/[一-鿿]/g)[1]; // "丙辰年" → 辰
    assert.equal(BRANCHES_HANJA[yearBranchIndex(y)], jijiHanja, `${y}년 지지 불일치`);
  }
  assert.equal(yearBranchIndex(1976), 4); // 진(辰)
});

// §6-2 PM 스모크: 양력 1976-02-28 02:30 → 음 1976-01-29 병진년(辰), 축시.
//   기본 순행이라 성별 무관 → 단일 앵커로 고정. ⚠ R3 수기 대조 대상.
//   초년 辰천간 · 중년 辰천간 · 말년 申천고 · 총운 酉천인.
test("§6-2 스모크: 1976-02-28 02:30 → 음1976-01-29 축시 (순행 단일)", () => {
  const n = normalizeBirth({ year: 1976, month: 2, day: 28, calendar: "solar", isLeapMonth: false });
  assert.deepEqual(n.birthLunar, { year: 1976, month: 1, day: 29 });
  assert.equal(n.leapNormalized, false);

  const hb = hourBranch(2, 30);
  assert.equal(hb.number, 2); // 축(丑) = 시수 2
  assert.equal(yearBranchIndex(1976), 4); // 진(辰)

  const c = makeChart({ yearIndex: 4, lunarMonth: 1, lunarDay: 29, hourNumber: 2, dir: FWD });
  assert.deepEqual([c.year, c.month, c.day, c.hour], [4, 4, 8, 9]); // 진·진·신·유
  assert.deepEqual([starAt(c.year), starAt(c.month), starAt(c.day), starAt(c.hour)],
    ["천간성", "천간성", "천고성", "천인성"]);
});

// §6-3 생시 미상: hourNumber null → 시성(hour) 없음, 3성만.
test("§6-3 생시 미상: hour null (3성)", () => {
  const c = makeChart({ yearIndex: 4, lunarMonth: 1, lunarDay: 29, hourNumber: null, dir: FWD });
  assert.equal(c.hour, null);
  assert.equal(typeof c.year, "number");
  assert.equal(typeof c.month, "number");
  assert.equal(typeof c.day, "number");
  assert.ok(!c.trace.includes("시성"));
});

// §6-4 윤달 정규화: 음력 윤달 입력은 평달로 간주(월 번호 그대로), leapNormalized=true.
test("§6-4 윤달 정규화: 음력 윤달 입력 → 평달 간주", () => {
  const leap = normalizeBirth({ year: 2020, month: 4, day: 15, calendar: "lunar", isLeapMonth: true });
  assert.equal(leap.birthLunar.month, 4);
  assert.equal(leap.leapNormalized, true);
  const plain = normalizeBirth({ year: 2020, month: 4, day: 15, calendar: "lunar", isLeapMonth: false });
  assert.equal(plain.birthLunar.month, leap.birthLunar.month);
});

// §6-5 양력↔음력 왕복 검증.
test("§6-5 양력↔음력 왕복 일치", () => {
  for (const [y, m, d] of [[1976, 2, 28], [1960, 3, 28], [2024, 1, 1]]) {
    const lunar = solarToLunar(y, m, d);
    const solar = lunarToSolar(lunar.year, lunar.month, lunar.day, lunar.intercalation);
    assert.deepEqual(solar, { year: y, month: m, day: d }, `왕복 실패: ${y}-${m}-${d}`);
  }
});

// §6-6 경계: 12를 넘는 순행 wrap, 역행 음수 wrap.
test("§6-6 순환 wrap: 순행·역행 12 경계", () => {
  assert.equal(mod12(15), 3);
  assert.equal(mod12(-1), 11);
  assert.equal(mod12(-24), 0);
  // 순행: 亥(11)에서 3칸(생일 4) → 子·丑·寅 순환 = 寅(2)
  const fwd = makeChart({ yearIndex: 11, lunarMonth: 1, lunarDay: 4, hourNumber: null, dir: FWD });
  assert.equal(fwd.day, 2);
  // 역행: 子(0)에서 반시계 3칸(생일 4) → 亥·戌·酉 = 酉(9)
  const bwd = makeChart({ yearIndex: 0, lunarMonth: 1, lunarDay: 4, hourNumber: null, dir: BWD });
  assert.equal(bwd.day, 9);
});

// 시진표: HH:MM → 시진 경계 (:30 보정). 子 23:30~01:30 … 亥 21:30~23:30.
test("시진표 경계: 00:00·01:30·02:30·23:29·23:30", () => {
  assert.equal(BRANCHES[hourBranch(0, 0).index], "자");
  assert.equal(BRANCHES[hourBranch(1, 30).index], "축");
  assert.equal(BRANCHES[hourBranch(2, 30).index], "축");
  assert.equal(BRANCHES[hourBranch(23, 29).index], "해");
  assert.equal(BRANCHES[hourBranch(23, 30).index], "자");
  assert.equal(hourBranch(0, 0).number, 1); // 자=시수 1
  assert.equal(hourBranch(11, 30).number, 7); // 오=시수 7 (앵커 검증용)
  assert.equal(hourBranch(23, 29).number, 12); // 해=시수 12
});

// 데이터 무결성: 12지 × 9필드 완전성(jang 보존 포함), 고정 배속, 오염문자 부재.
test("데이터 무결성: 12지 × 9필드 + 고정 배속 + 오염문자 부재", () => {
  const FIELDS = ["jiji", "star", "hanja", "symbol", "summary", "cho", "cheong", "jang", "mal"];
  // 지지 인덱스(子=0..亥=11) 순 기대 배속.
  const EXPECTED = ["천귀성", "천액성", "천권성", "천파성", "천간성", "천문성",
    "천복성", "천역성", "천고성", "천인성", "천예성", "천수성"];
  assert.equal(ENTRIES.length, 12); // _meta 제외 12항목
  for (let i = 0; i < 12; i++) {
    const e = STARS[i];
    assert.ok(e, `지지 항목 누락: ${BRANCHES_HANJA[i]}`);
    for (const f of FIELDS) assert.ok(e[f] && e[f].length > 0, `${BRANCHES_HANJA[i]}.${f} 없음`);
    assert.equal(e.star, EXPECTED[i], `${BRANCHES_HANJA[i]} 배속 불일치`);
  }
  const all = JSON.stringify(ENTRIES);
  assert.equal((all.match(/�/g) || []).length, 0, "U+FFFD 깨짐문자 잔존");
  assert.equal((all.match(/[｢｣「」]/g) || []).length, 0, "오염문자 잔존");
});
