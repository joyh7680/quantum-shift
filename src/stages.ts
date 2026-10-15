// The current game's `stage` field tracks seven missions INSIDE Stage 01.
// No names or gameplay plans for the other city zones exist in this checkout.
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
  ...[2, 3, 4].map((number) => ({
    number,
    name: "미공개 구역",
    available: false,
    description: "추후 공개",
    objective: "구역의 목표는 추후 공개됩니다.",
    play: ["주요 플레이 추후 공개"],
  })),
  {
    number: 5,
    name: "거대 로봇 보스",
    available: false,
    description: "거대 로봇과 마주하는 마지막 스테이지.",
    objective: "거대 로봇 보스에 도전하세요. 상세 목표는 추후 공개됩니다.",
    play: ["보스 전투의 주요 플레이 추후 공개"],
  },
];
