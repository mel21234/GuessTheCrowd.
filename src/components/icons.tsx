/** Inline SVG icons (no icon font, no emoji in the UI). All decorative: aria-hidden. */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const HelpIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M9.4 9.2a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.3-2.6 3.9" />
    <circle cx="12" cy="17.2" r="0.6" fill="currentColor" />
  </Svg>
);

export const StatsIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 20V12M12 20V5M19 20v-8" />
  </Svg>
);

export const GearIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Svg>
);

export const GlobeIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M2.5 12h19M12 2.5c2.6 2.6 3.9 5.8 3.9 9.5s-1.3 6.9-3.9 9.5c-2.6-2.6-3.9-5.8-3.9-9.5S9.4 5.1 12 2.5z" />
  </Svg>
);

export const CloseIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const CheckIcon = (p: P) => (
  <Svg strokeWidth={3} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const ArrowUpIcon = (p: P) => (
  <Svg strokeWidth={2.75} {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
);

export const ArrowDownIcon = (p: P) => (
  <Svg strokeWidth={2.75} {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Svg>
);

/** Double chevrons: "far off" — distinguishable from "close" by shape, not only colour. */
export const DoubleUpIcon = (p: P) => (
  <Svg strokeWidth={2.75} {...p}>
    <path d="M6 12l6-6 6 6M6 19l6-6 6 6" />
  </Svg>
);
export const DoubleDownIcon = (p: P) => (
  <Svg strokeWidth={2.75} {...p}>
    <path d="M6 5l6 6 6-6M6 12l6 6 6-6" />
  </Svg>
);

export const ShareIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </Svg>
);

export const MinusIcon = (p: P) => (
  <Svg strokeWidth={2.75} {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const PlusIcon = (p: P) => (
  <Svg strokeWidth={2.75} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const BackIcon = (p: P) => (
  <Svg {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
);
