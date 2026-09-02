const baseProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function LuDoneMark({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="10" fill="currentColor" />
      <path
        d="M10 8.5v9.25c0 3.3 2.35 5.75 6 5.75s6-2.45 6-5.75V8.5"
        stroke="var(--mark-ink, #171717)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="m13 16 2.2 2.2L20 13.4"
        stroke="var(--mark-ink, #171717)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MicIcon() {
  return (
    <svg {...baseProps}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
    </svg>
  );
}

export function TimerIcon() {
  return (
    <svg {...baseProps}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.75 1.75M9 2h6M12 2v3" />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg {...baseProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.83 2.83-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-4v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06-2.83-2.83.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3v-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06 2.83-2.83.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3h4v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06 2.83 2.83-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21v4h-.09A1.65 1.65 0 0 0 19.4 15Z" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...baseProps}>
      <path d="m7 7 10 10M17 7 7 17" />
    </svg>
  );
}

export function ArrowRightIcon() {
  return (
    <svg {...baseProps}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...baseProps}>
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

export function BrowserIcon() {
  return (
    <svg {...baseProps}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M3 9h18M7 6.5h.01M10 6.5h.01" />
    </svg>
  );
}

export function VolumeIcon() {
  return (
    <svg {...baseProps}>
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5ZM15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}

export function CloudIcon() {
  return (
    <svg {...baseProps}>
      <path d="M7 18h11a4 4 0 0 0 .7-7.94A7 7 0 0 0 5.22 8.7 4.7 4.7 0 0 0 7 18Z" />
      <path d="m9 13 3-3 3 3M12 10v6" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg {...baseProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg {...baseProps}>
      <rect x="5" y="10" width="14" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg {...baseProps}>
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}
