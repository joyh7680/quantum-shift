import { useId } from "react";

// Draw the lettering as geometry so the title keeps its silhouette on every device.
const letters = {
  Q: "M16 0H56L72 16V80L60 92H48L60 106H39L27 92H16L0 76V16ZM22 17L18 21V71L23 76H49L54 71V21L50 17Z",
  U: "M0 0H18V70L24 76H46L52 70V0H70V78L56 92H14L0 78Z",
  A: "M27 0H47L76 92H56L51 73H22L17 92H0ZM36 24L26 57H47Z",
  N: "M0 92V0H18L54 58V0H72V92H54L18 34V92Z",
  T: "M0 0H68V18H43V92H25V18H0Z",
  M: "M0 92V0H20L42 43L64 0H84V92H66V32L46 70H38L18 32V92Z",
  C: "M16 0H57L72 15V29H54V22L49 17H24L18 23V69L24 75H49L54 70V63H72V78L58 92H16L0 76V16Z",
  I: "M0 0H20V92H0Z",
  Y: "M0 0H21L38 34L55 0H76L47 54V92H29V54Z",
};

export function TitleLogo() {
  const id = useId().replace(/:/g, "");
  const quantum = [
    ["Q", 0],
    ["U", 80],
    ["A", 158],
    ["N", 242],
    ["T", 322],
    ["U", 398],
    ["M", 476],
  ] as const;
  const city = [
    ["C", 0],
    ["I", 125],
    ["T", 198],
    ["Y", 319],
  ] as const;
  const wordmark = (
    <>
      <g transform="translate(24 10) skewX(-8)">
        {quantum.map(([letter, x]) => (
          <path key={x} d={letters[letter]} transform={`translate(${x} 0)`} />
        ))}
      </g>
      <g transform="translate(112 132) skewX(-8) scale(.94 .82)">
        {city.map(([letter, x]) => (
          <path key={x} d={letters[letter]} transform={`translate(${x} 0)`} />
        ))}
      </g>
    </>
  );

  return (
    <h1 className="cinematic-title" aria-label="QUANTUM CITY · 퀀텀시티">
      <svg
        className="title-logo"
        viewBox="0 0 600 224"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0.1" y2="1">
            <stop stopColor="#ffffff" />
            <stop offset=".27" stopColor="#dfebf6" />
            <stop offset=".49" stopColor="#91a6be" />
            <stop offset=".51" stopColor="#526a83" />
            <stop offset=".57" stopColor="#b0c9df" />
            <stop offset=".81" stopColor="#edf9ff" />
            <stop offset="1" stopColor="#8ba9c3" />
          </linearGradient>
          <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#f1fcff" />
            <stop offset=".45" stopColor="#d0e8ff" stopOpacity=".55" />
            <stop offset="1" stopColor="#5396bf" stopOpacity=".75" />
          </linearGradient>
          <linearGradient
            id={`${id}-beam`}
            gradientUnits="userSpaceOnUse"
            x1="12"
            y1="119"
            x2="581"
            y2="119"
          >
            <stop stopColor="#66ddff" stopOpacity="0" />
            <stop offset=".35" stopColor="#70e5ff" stopOpacity=".6" />
            <stop offset=".64" stopColor="#ecfdff" />
            <stop offset="1" stopColor="#70e5ff" stopOpacity="0" />
          </linearGradient>
          <filter
            id={`${id}-glow`}
            x="-50%"
            y="-800%"
            width="200%"
            height="1700%"
          >
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <g
          fill="#192f49"
          stroke="#385775"
          strokeWidth="1"
          transform="translate(0 4)"
        >
          {wordmark}
        </g>
        <g
          fill={`url(#${id}-metal)`}
          stroke={`url(#${id}-edge)`}
          strokeWidth=".8"
          fillRule="evenodd"
        >
          {wordmark}
        </g>
        <path
          d="M12 119H581"
          stroke={`url(#${id}-beam)`}
          strokeWidth="3"
          filter={`url(#${id}-glow)`}
        />
        <path d="M12 119H581" stroke={`url(#${id}-beam)`} strokeWidth=".8" />
        <path
          d="M34 167H78L66 181H22M507 167H566L554 181H495"
          stroke="#7fb7d4"
          strokeOpacity=".45"
          strokeWidth="1"
        />
        <path
          d="M78 167L66 181M507 167L495 181"
          stroke="#a4ebff"
          strokeWidth="2"
        />
      </svg>
      <span className="title-localized" aria-hidden="true">
        <span /> 퀀텀시티 <span />
      </span>
    </h1>
  );
}
