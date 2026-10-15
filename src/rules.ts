export type Scale = 0.25 | 1 | 2.5;
export type SuitProgram = {
  trigger: "laser-near";
  action: "shrink";
  restore: "previous-safe";
  range: number;
};
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
