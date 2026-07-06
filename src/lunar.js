// lunar.js — 음양력 변환 + 생일 정규화. korean-lunar-calendar 래퍼(순수·부작용 없음).
// index.js와 테스트가 공유한다. 당사주는 간지가 불필요하여 변환 함수만 둔다.

import KoreanLunarCalendar from "korean-lunar-calendar";

const KLC = KoreanLunarCalendar.default || KoreanLunarCalendar;

// 양력 → 음력. { year, month, day, intercalation } 반환.
export function solarToLunar(year, month, day) {
  const c = new KLC();
  if (!c.setSolarDate(year, month, day)) throw new Error(`유효하지 않은 양력 날짜: ${year}-${month}-${day}`);
  return c.getLunarCalendar();
}

// 음력 → 양력 (감사·왕복검증용). { year, month, day } 반환.
export function lunarToSolar(year, month, day, isLeap = false) {
  const c = new KLC();
  if (!c.setLunarDate(year, month, day, isLeap)) throw new Error(`유효하지 않은 음력 날짜: ${year}-${month}-${day} (윤달=${isLeap})`);
  return c.getSolarCalendar();
}

// 생년월일(입력) → 정규화된 음력 생일 + 감사용 양력. 윤달은 평달로 정규화한다(당사주 통례).
export function normalizeBirth({ year, month, day, calendar, isLeapMonth }) {
  if (calendar === "solar") {
    const lunar = solarToLunar(year, month, day);
    return {
      birthLunar: { year: lunar.year, month: lunar.month, day: lunar.day },
      solarBirth: { year, month, day },
      leapNormalized: lunar.intercalation,
    };
  }
  const solar = lunarToSolar(year, month, day, isLeapMonth);
  return {
    birthLunar: { year, month, day },
    solarBirth: solar,
    leapNormalized: isLeapMonth,
  };
}
