import luDoneMark from "../assets/LuDone.svg";

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

function OpusIcon({ name, size = 20 }) {
  const wideGlyphs = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    down: <path d="m6 9 6 6 6-6" />,
    edit: <path d="m4 16-1 5 5-1L20 8l-4-4ZM14 6l4 4" />,
    file: <path d="M5 3h9l5 5v13H5ZM14 3v6h5M9 14h6M9 17h4" />,
    folder: <path d="M3 6h6l2 3h10v11H3Z" />,
    keyboard: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M6 9h1m3 0h1m3 0h1m3 0h1M6 13h1m3 0h1m3 0h1m3 0h1M7 16h10" /></>,
    link: <><path d="m9 15 6-6M7 10l-3 3a4 4 0 0 0 6 6l3-3M11 8l3-3a4 4 0 0 1 6 6l-3 3" /></>,
    play: <path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none" />,
    plus: <path d="M12 4v16M4 12h16" />,
    refresh: <path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6" />,
    trash: <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 22v-3a8 8 0 0 1 16 0v3" /></>,
    download: <path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5" />,
  };
  const isWide = Object.hasOwn(wideGlyphs, name);
  const props = {
    width: size,
    height: size,
    viewBox: isWide ? "0 0 24 24" : "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: isWide ? 1.7 : 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const glyphs = {
    alert: <><path d="M6 1.4 11.2 10.5H.8Z" /><path d="M6 4.8v2.6" /><circle cx="6" cy="9" r=".75" fill="currentColor" stroke="none" /></>,
    back: <path d="M10 3.5 5.5 8l4.5 4.5" />,
    bolt: <path d="M9 2 4 9h4l-1 5 5-7H8z" />,
    check: <path d="M2.5 6.3 5 8.6l4.6-5" />,
    close: <path d="m4 4 8 8M12 4l-8 8" />,
    external: <path d="M6 3.5h6.5V10M12.3 3.7 4 12" />,
    gear: <><path d="M2.5 4.5h7M12.5 4.5h1M2.5 11.5h1M6.5 11.5h7" /><circle cx="11" cy="4.5" r="1.6" /><circle cx="5" cy="11.5" r="1.6" /></>,
    mac: <><rect x="2" y="2.3" width="8" height="5.6" /><path d="M.8 10h10.4" /></>,
    search: <><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3.5 3.5" /></>,
    stop: <rect x="4" y="4" width="8" height="8" fill="currentColor" stroke="none" />,
    wait: <><circle cx="6" cy="6" r="4.3" /><path d="M6 3.8V6l1.6 1" /></>,
    wave: <path d="M2 8h1M5 5.5v5M8 3v10M11 5v6M14 8h-.2" />,
    window: <><rect x="2" y="3" width="12" height="10" /><path d="M2 6h12" /></>,
    upload: <><path d="M6 10V2.5M3 5.3l3-2.9 3 2.9" /><path d="M1 11v3h10v-3" /></>,
    wifi: <><path d="M2 6.2a8.5 8.5 0 0 1 12 0M4.3 8.6a5.2 5.2 0 0 1 7.4 0M6.5 11a2 2 0 0 1 3 0" /></>,
    wifiOff: <><path d="M2 6.2a8.5 8.5 0 0 1 12 0M4.3 8.6a5.2 5.2 0 0 1 7.4 0M6.5 11a2 2 0 0 1 3 0" opacity=".35" /><path d="m3 2.5 10 11" /></>,
    work: <><circle cx="8" cy="8" r="5.8" /><path d="M8 4.8v3.4l2.3 1.4" /></>,
  };

  return <svg {...props}>{wideGlyphs[name] ?? glyphs[name]}</svg>;
}

export function LuDoneMark({ size = 28, variant = "default" }) {
  return <img className={`ludone-mark${variant === "panel" ? " ludone-mark--panel" : ""}`} src={luDoneMark} width={size} height={size} alt="" />;
}

export function LuDoneGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <g transform="scale(.02)">
        <rect x="363.43" y="479.05" width="615.7" height="103.05" transform="translate(-143.27 792.56) rotate(-56.15)" />
        <rect x="352.1" y="457.81" width="103.05" height="403.78" transform="translate(-369.09 627.47) rotate(-56.15)" />
        <rect x="618.07" y="771.07" width="403.78" height="103.05" transform="translate(-329.27 654.46) rotate(-36.77)" />
      </g>
    </svg>
  );
}

export function MicIcon({ variant = "default" }) {
  return <OpusIcon name="wave" size={variant === "idle" ? 18 : 20} />;
}

export function TimerIcon({ variant = "default" }) {
  return <OpusIcon name="work" size={variant === "idle" ? 18 : 20} />;
}

export function AccessDeniedIcon() {
  return <OpusIcon name="alert" />;
}

export function OfflineIcon() {
  return <OpusIcon name="wifiOff" />;
}

export function SettingsIcon() {
  return <OpusIcon name="gear" />;
}

export function ArchiveIcon() {
  return <OpusIcon name="folder" />;
}

export function CloseIcon() {
  return <OpusIcon name="close" />;
}

export function ArrowRightIcon() {
  return <OpusIcon name="arrow" />;
}

export function ArrowLeftIcon() {
  return <OpusIcon name="back" />;
}

export function CheckIcon() {
  return <OpusIcon name="check" size={16} />;
}

export function BrowserIcon() {
  return <OpusIcon name="window" />;
}

export function VolumeIcon() {
  return <OpusIcon name="wave" />;
}

export function CloudIcon() {
  return <OpusIcon name="upload" />;
}

export function UserIcon() {
  return <OpusIcon name="user" />;
}

export function KeyboardIcon() {
  return <OpusIcon name="keyboard" />;
}

export function RefreshIcon() {
  return <OpusIcon name="refresh" />;
}

export function PlayIcon() {
  return <OpusIcon name="play" />;
}


export function WaitingIcon() {
  return <OpusIcon name="wait" />;
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
  return <OpusIcon name="down" />;
}
