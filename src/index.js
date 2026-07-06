#!/usr/bin/env node
// index.js — 당사주 MCP 서버 (stdio).
// 결정론적 구조화 데이터만 반환한다. 해석·조언·페르소나는 상위 레이어(SKILL/LLM)의 몫이다.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { yearBranchIndex, hourBranch, makeChart } from "./calc.js";
import { normalizeBirth } from "./lunar.js";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const RAW = JSON.parse(readFileSync(join(dataDir, "dangsaju_12stars.json"), "utf8"));

// 데이터 키 스킴(로마자·한글 무관)·_meta 유무에 견고하도록, 각 별 항목을 jiji 한자로 인덱싱한다.
// STARS[i]는 지지 인덱스 i(子=0..亥=11)에 배속된 별 항목이다.
const BRANCH_HANJA = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const ENTRIES = Object.values(RAW).filter((e) => e && e.jiji); // _meta 등 비-지지 키 제외
const STARS = BRANCH_HANJA.map((h) => {
  const e = ENTRIES.find((x) => x.jiji.includes(h));
  if (!e) throw new Error(`데이터에 지지 항목 없음: ${h}`);
  return e;
});

const pad2 = (n) => String(n).padStart(2, "0");
const ymd = ({ year, month, day }) => `${year}-${pad2(month)}-${pad2(day)}`;

// 지지 인덱스 → 별 노드. pillar(년/월/일/시성) + 시기 라벨 + reading 필드명을 붙인다.
function starNode(pillar, position, branchIndex, readingField) {
  const e = STARS[branchIndex];
  return {
    pillar,
    position,
    jiji: e.jiji,
    star: e.star,
    hanja: e.hanja,
    symbol: e.symbol,
    summary: e.summary,
    reading: e[readingField],
  };
}

// 방향 부호 산출. 기본은 순행 고정(남녀 동일). 변형 모드만 남순여역(sex 필수).
function resolveDir(direction, sex) {
  if (direction === "male_forward_female_backward") {
    if (!sex) return { error: "direction='male_forward_female_backward'는 sex('male'|'female')가 필요합니다." };
    return { dir: sex === "male" ? 1 : -1 };
  }
  return { dir: 1 }; // forward
}

const server = new McpServer({ name: "dangsaju-mcp", version: "1.0.0" });

server.registerTool(
  "dangsaju_reading",
  {
    title: "당사주 12성 사주 조회",
    description:
      "생년월일시로 당사주(唐四柱) 12성(星)을 산출한다. 년성(초년)·월성(중년)·일성(말년)·시성(총운·평생)의 지지·별과 해당 시기 해설 원문을 그대로 반환한다. 세기는 inclusive, 방향은 순행 고정(남녀 동일)이 기본이며 남순여역은 변형 모드로 지원한다. 해석·조언은 생성하지 않는 데이터 전용 도구다.",
    inputSchema: {
      birth_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식")
        .describe("생년월일 (YYYY-MM-DD)"),
      calendar: z
        .enum(["solar", "lunar"])
        .default("solar")
        .describe("입력 달력 종류 (기본 solar=양력)"),
      is_leap_month: z
        .boolean()
        .default(false)
        .describe("음력 윤달 여부 (calendar=lunar일 때만 유효, 평달로 정규화)"),
      birth_time: z
        .string()
        .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "HH:MM 형식(24시)")
        .optional()
        .describe("출생 시각 (HH:MM). 미입력 시 시성(총운·평생) 제외, 년·월·일성만 반환"),
      direction: z
        .enum(["forward", "male_forward_female_backward"])
        .default("forward")
        .describe("방향 규칙. forward=순행 고정(기본). male_forward_female_backward=남순여역 변형(sex 필요)"),
      sex: z
        .enum(["male", "female"])
        .optional()
        .describe("성별. direction=male_forward_female_backward일 때만 사용(male=순행, female=역행)"),
    },
  },
  async ({ birth_date, calendar, is_leap_month, birth_time, direction, sex }) => {
    const { dir, error } = resolveDir(direction, sex);
    if (error) return { content: [{ type: "text", text: error }], isError: true };

    const [year, month, day] = birth_date.split("-").map(Number);

    const { birthLunar, solarBirth, leapNormalized } = normalizeBirth({
      year,
      month,
      day,
      calendar,
      isLeapMonth: is_leap_month,
    });

    let hourNumber = null;
    let hourJiji = null;
    if (birth_time) {
      const [hh, mm] = birth_time.split(":").map(Number);
      const hb = hourBranch(hh, mm);
      hourNumber = hb.number;
      hourJiji = STARS[hb.index].jiji;
    }

    const chart = makeChart({
      yearIndex: yearBranchIndex(birthLunar.year),
      lunarMonth: birthLunar.month,
      lunarDay: birthLunar.day,
      hourNumber,
      dir,
    });

    // 주류 정렬: 년성=초년(cho) · 월성=중년(cheong) · 일성=말년(mal) · 시성=총운·평생(summary).
    // jang(장년) 필드는 데이터에 보존하되 기본 조합에서는 쓰지 않는다.
    const stars = {
      cho: starNode("년성", "초년", chart.year, "cho"),
      cheong: starNode("월성", "중년", chart.month, "cheong"),
      mal: starNode("일성", "말년", chart.day, "mal"),
    };
    if (chart.hour != null) stars.summary = starNode("시성", "총운·평생", chart.hour, "summary");

    const result = {
      stars,
      meta: {
        calendar_input: calendar,
        direction,
        sex: sex ?? null,
        lunar_birth: ymd(birthLunar),
        solar_birth: ymd(solarBirth),
        leap_month_normalized: leapNormalized,
        birth_hour_jiji: hourJiji,
        time_unknown: hourNumber == null,
        calc_trace: chart.trace,
      },
    };

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "dangsaju_star_lookup",
  {
    title: "당사주 별 원문 조회",
    description:
      "지지(자~해 또는 子~亥) 또는 별 이름(예: 천귀성)으로 해당 별의 원문 전체(상징·총평·시기별 해설 cho/cheong/jang/mal)를 그대로 조회한다. 브라우징·테스트·SKILL 개발용 보조 도구다.",
    inputSchema: {
      jiji: z.string().optional().describe("지지 (한글 자~해 또는 한자 子~亥)"),
      star: z.string().optional().describe("별 이름 (예: 천귀성 또는 天貴星)"),
    },
  },
  async ({ jiji, star }) => {
    // e.jiji는 "자(子)" 형태라 includes로 한글·한자·결합형이 모두 매칭된다.
    let entry = null;
    if (jiji) entry = ENTRIES.find((e) => e.jiji.includes(jiji));
    if (!entry && star) entry = ENTRIES.find((e) => e.star === star || e.hanja === star);
    if (!entry) {
      return {
        content: [{ type: "text", text: `조회 실패: jiji='${jiji ?? ""}' star='${star ?? ""}'` }],
        isError: true,
      };
    }
    return { content: [{ type: "text", text: JSON.stringify(entry, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
