// calc.js — 당사주 작괘(作卦) 순수 함수. I/O 없음 → 단독 테스트 가능.
//
// 세기 규칙 (1차 소스 황룡사 완주 예시 2건으로 재현·확정, README 참조):
//   · inclusive — 출발 지지를 1로 포함해서 센다.
//   · 순행 고정(남녀 동일)이 기본. 방향 부호 dir(+1 순행 / −1 역행)은 호출부가 정한다.
//     (남순여역은 변형 모드로만 dir=−1을 넘긴다.)
//
//   년성(年星) = 음력 출생년의 지지        → 초년
//   월성(月星) = 년성에서 (생월−1)칸 이동   → 중년
//   일성(日星) = 월성에서 (생일−1)칸 이동   → 말년
//   시성(時星) = 일성에서 (시수−1)칸 이동   → 총운·평생, 시수 子1~亥12
//
// 12지지 순환은 mod12로 감싼다. 시기 표기·해설 필드 매핑은 index.js가 담당한다.

// 지지 12개 (순행 순서). 데이터 JSON의 키(hangul)와 동일 순서·표기.
export const BRANCHES = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];

// 음(−) 결과까지 0~11로 정규화하는 순환 나머지.
export const mod12 = (n) => ((n % 12) + 12) % 12;

// 음력 연도 → 지지 인덱스. 서기 4년(甲子)이 자(子)=0 기준.
export const yearBranchIndex = (lunarYear) => mod12(lunarYear - 4);

// HH:MM → { number(시수 1~12), index(지지 0~11) }.
// 시진 경계는 :30 (한국 통용 30분 보정). 子 23:30~01:30 … 亥 21:30~23:30, 2시간 간격.
export function hourBranch(hh, mm) {
  const minutes = hh * 60 + mm;
  const index = Math.floor(((minutes + 30) % 1440) / 120); // 子=0 … 亥=11
  return { number: index + 1, index };
}

// 4성(년·월·일·시)의 지지 인덱스를 산출한다.
//   yearIndex   : 음력 출생년의 지지 인덱스
//   lunarMonth  : 음력 생월 (1~12, 정규화된 평달)
//   lunarDay    : 음력 생일 (1~30)
//   hourNumber  : 시수 (1~12) 또는 null(생시 미상 → 시성 없음)
//   dir         : +1 순행 / −1 역행
export function makeChart({ yearIndex, lunarMonth, lunarDay, hourNumber, dir }) {
  const year = yearIndex;
  const month = mod12(year + dir * (lunarMonth - 1));
  const day = mod12(month + dir * (lunarDay - 1));
  const hour = hourNumber == null ? null : mod12(day + dir * (hourNumber - 1));

  const arrow = dir === 1 ? "순행" : "역행";
  const b = (i) => BRANCHES[i];
  const steps = [
    `년성 ${b(year)}`,
    `월성 ${b(month)}(생월 ${lunarMonth}, ${arrow})`,
    `일성 ${b(day)}(생일 ${lunarDay}, ${arrow})`,
  ];
  if (hour != null) steps.push(`시성 ${b(hour)}(시수 ${hourNumber}, ${arrow})`);

  return { year, month, day, hour, trace: steps.join(" → ") };
}
