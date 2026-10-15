export type Scale = 0.25 | 1 | 2.5;
export type SuitProgram = {
  trigger: "laser-near";
  action: "shrink";
  restore: "previous-safe";
  range: number;
};
export const VALID_ORDER = ["메인 전원", "A", "B", "C"];
export function checkOrder(order: string[]) {
  return order.join("|") === VALID_ORDER.join("|");
}
export function compileRequest(input: string): {
  program?: SuitProgram;
  error?: string;
} {
  const text = input.toLowerCase().trim();
  if (
    /무적|순간이동|날[아기]|비행|파괴|삭제|죽|eval|script|fetch|무한|점프/.test(
      text,
    )
  )
    return {
      error:
        "지원하지 않는 능력입니다. 이 시뮬레이터는 레이저 감지 → 초소형 변환 → 이전 크기로 안전 복귀만 지원합니다.",
    };
  if (!/레이저|laser/.test(text) || !/작아|작게|축소|shrink|초소형/.test(text))
    return {
      error: "레이저를 감지하는 조건과 작아지는 동작을 함께 적어주세요.",
    };
  if (!/복귀|돌아|이전|원래|restore|return/.test(text))
    return {
      error: "레이저가 지나간 뒤 이전 크기로 복귀하는 조건도 필요합니다.",
    };
  if (
    /안\s*작|작아지지|축소\s*하지|복귀\s*하지|지\s*말|하지\s*마|않/.test(text)
  )
    return {
      error:
        "축소와 복귀를 수행하는 요청이 필요합니다. 명령어를 수정하거나 도움말을 확인해 주세요.",
    };
  return {
    program: {
      trigger: "laser-near",
      action: "shrink",
      restore: "previous-safe",
      range: 2.4,
    },
  };
}
export function codeFor(program: SuitProgram) {
  return `// 허용된 슈트 명령으로 변환된 코드\non laser.near(${program.range}) {\n  remember(size);\n  suit.shrink(0.25);\n}\non laser.clear {\n  if (space.fits(previousSize)) {\n    suit.restore(previousSize);\n  } else {\n    suit.waitUntilSafe();\n  }\n}`;
}
export function suitDecision(
  program: SuitProgram,
  near: boolean,
  current: Scale,
  previous: Scale,
  fits: boolean,
) {
  if (
    program.trigger !== "laser-near" ||
    program.action !== "shrink" ||
    program.restore !== "previous-safe"
  )
    return { size: current, waiting: false };
  if (near) return { size: 0.25 as Scale, waiting: false };
  return { size: fits ? previous : current, waiting: !fits };
}
export function testSuit(program: SuitProgram) {
  const shrink = suitDecision(program, true, 2.5, 2.5, true);
  const wait = suitDecision(program, false, shrink.size, 2.5, false);
  const restore = suitDecision(program, false, wait.size, 2.5, true);
  return [
    shrink.size === 0.25,
    wait.size === 0.25 && wait.waiting,
    restore.size === 2.5 && !restore.waiting,
  ];
}
export const SIZE_NAMES: Record<Scale, string> = {
  0.25: "초소형",
  1: "일반",
  2.5: "거대",
};
export const MISSIONS = [
  [
    "연구실 탐험",
    "WASD로 이동하고 Space로 점프하세요. 1·2·3으로 크기를 바꿔보세요.",
  ],
  [
    "작아져야 보이는 길",
    "1키로 초소형이 되어 앞쪽의 낮은 환풍구를 통과하세요.",
  ],
  [
    "잠든 연구실 깨우기",
    "3키로 거대화 → 배터리에서 E → 발전기에 운반 후 E. 일반 크기로 전원 콘솔을 조작하세요.",
  ],
  [
    "나만의 슈트 개발",
    "앞 방의 보라색 슈트 콘솔에서 E. 능력을 생성하고 테스트한 뒤 장착하세요.",
  ],
  ["빛보다 작은 존재", "Q로 자동 축소를 켜고 레이저 통로를 통과하세요."],
  [
    "연구실의 수호자",
    "레이저를 자동 축소로 피하면 약점이 열립니다. 거대화 후 가까이서 E로 3회 공격하세요.",
  ],
  ["마지막 한 걸음", "열린 민트색 탈출문으로 이동하세요."],
];
