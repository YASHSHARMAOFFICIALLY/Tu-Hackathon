/**
 * The icon set, inline.
 *
 * Six icons at ~200 bytes each is not a reason to install `lucide-react` and
 * ship an icon runtime. Every glyph is a 24-box stroke path on `currentColor`,
 * so they inherit the text colour of whatever they sit in and never need a
 * second fill declaration.
 *
 * Decoration by default: an icon that sits beside its own label carries no
 * meaning of its own, so it is hidden from assistive technology unless the
 * caller passes a `label`.
 */
type IconProps = { className?: string; label?: string };

function Svg({
  className = "size-[18px]",
  label,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.75 20v-5.5h4.5V20" />
    </Svg>
  );
}

export function ReportIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" />
      <path d="M14 3v5h5" />
      <path d="M12 11.5v5M9.5 14h5" />
    </Svg>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </Svg>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 20v-6M12.7 20V8.5M17.4 20v-9" />
    </Svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </Svg>
  );
}

export function ArchiveIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="6" rx="7.5" ry="3" />
      <path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" />
      <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
    </Svg>
  );
}

/** Two people: the roles console lists accounts, not archives or records. */
export function PeopleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3.5 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6" />
      <path d="M18 14.4c1.7 1 2.8 2.9 2.8 5.1" />
    </Svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
    </Svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4.2 3.3 19.2h17.4L12 4.2Z" />
      <path d="M12 10v4M12 17h.01" />
    </Svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </Svg>
  );
}
