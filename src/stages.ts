// The current game's `stage` field tracks seven missions INSIDE Stage 01.
// These city-stage briefs are informational; only Stage 01 is playable.
export const CITY_STAGES = [
  {
    number: 1,
    name: "거인의 연구실",
    available: true,
    description: "작은 몸으로 거대한 연구실의 비밀을 풀어보세요.",
    objective: "크기를 바꾸고 장치를 복구해 연구실을 탈출하세요.",
    play: [
      "초소형으로 환풍구 통과",
      "거대화로 배터리 운반",
      "전원 퍼즐과 슈트 능력 코딩",
      "자동 축소로 레이저 회피",
    ],
  },
  {
    number: 2,
    name: "마이크로 회로",
    available: false,
    description: "초소형으로 변신해 컴퓨터 내부를 탐험하고 회로를 복구.",
    objective: "슈트에 자동 장애물 회피 기능 제작",
    learning: "바이브 코딩 · 조건문",
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
