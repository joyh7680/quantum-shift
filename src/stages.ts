// Stages 1 and 2 have separate playable scenes and progress; later stages are briefs.
export const CITY_STAGES = [
  {
    number: 1,
    name: "거인의 연구실",
    available: true,
    description:
      "거대한 책상과 연필 사이에서 명령 블록을 모으고 환풍구로 탈출하세요.",
    objective: "모은 블록으로 크기 변환과 행동 순서를 구성해 탈출하기",
    learning: "알고리즘 · 순차 실행",
    codingTags: ["블록 코딩"],
    play: [
      "크기 변환으로 연구실 탐험",
      "도전하고 명령 블록 수집",
      "탈출 프로그램 조립과 실행",
    ],
  },
  {
    number: 2,
    name: "마이크로 회로",
    available: true,
    description:
      "자동 축소 슈트를 개발해 레이저를 통과하고 수호자에 도전하세요.",
    objective: "자동 축소 슈트 개발 → 레이저 통과 → 수호자 전투",
    learning: "바이브 코딩 · 조건문",
    play: [
      "자연어로 슈트 능력 생성·테스트·장착",
      "자동 축소로 레이저 통과",
      "자동 회피 후 거대화하여 수호자 약점 3회 공격",
    ],
  },
  {
    number: 3,
    name: "폭주한 공장",
    available: false,
    description: "움직이는 컨베이어와 거대한 기계 사이를 통과.",
    objective: "잘못된 자동 크기 변환 코드를 수정",
    learning: "디버깅 · 조건문",
  },
  {
    number: 4,
    name: "퀀텀 월드",
    available: false,
    description: "크기와 중력의 규칙이 달라지는 공간에서 탈출.",
    objective: "변수로 크기를 조절하고 이동 경로 설계",
    learning: "변수 · 비교 연산자",
  },
  {
    number: 5,
    name: "거대 로봇 보스",
    available: false,
    description: "거대 로봇과 마주하는 마지막 스테이지.",
    objective: "거대 로봇 보스에 도전하세요. 상세 목표는 추후 공개됩니다.",
    play: ["보스 전투의 주요 플레이 추후 공개"],
  },
];
