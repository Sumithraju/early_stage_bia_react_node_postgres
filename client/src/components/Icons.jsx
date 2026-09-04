/**
 * Small inline-SVG icons for the stepper and result tabs. Stroke-based and
 * drawn in currentColor so they inherit the active/muted tab colour. Kept as a
 * lookup so a tab just names its icon.
 */
const P = {
  strokeWidth: 1.7,
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const PATHS = {
  // Step 1 - Therapy area: target
  therapy: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>,
  // Step 2 - Population: people
  population: <><circle cx="9" cy="8" r="3" /><path d="M4 20c0-3 2.5-5 5-5s5 2 5 5" /><path d="M16 6.5a3 3 0 0 1 0 5.5M20 20c0-2.5-1.5-4.3-3.5-4.8" /></>,
  // Step 3 - Current care: pill
  care: <><rect x="3.5" y="9" width="17" height="6" rx="3" transform="rotate(45 12 12)" /><path d="M9 9l6 6" /></>,
  // Step 4 - Intervention: sparkle
  intervention: <><path d="M12 3l1.8 4.5L18 9l-4.2 1.5L12 15l-1.8-4.5L6 9l4.2-1.5z" /><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></>,
  // Step 5 - Uptake: trending up
  uptake: <><path d="M4 17l5-5 3 3 7-8" /><path d="M16 7h4v4" /></>,
  // Step 6 - Outcomes: heart pulse
  outcomes: <><path d="M12 20s-7-4.5-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.5-7 9-7 9z" /><path d="M6 12h2l1.5-2.5L12 14l1.5-3 1 1.5H18" /></>,
  // Results: bar chart
  results: <><path d="M4 20h16" /><rect x="6" y="12" width="3" height="6" /><rect x="11" y="8" width="3" height="10" /><rect x="16" y="4" width="3" height="14" /></>,
  // Done: check
  check: <path d="M5 12l4.5 4.5L19 7" />,
  // Result sub-tabs
  budget: <><path d="M4 20h16M7 16V9M12 16V5M17 16v-7" /></>,
  scenarios: <><path d="M4 18l5-6 3 3 8-9" /><path d="M4 12l5-3 4 4" opacity=".45" /></>,
  clinical: <><path d="M12 21s-7-4.5-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 12c0 4.5-7 9-7 9z" /></>,
  runs: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="1.4" fill="currentColor" stroke="none" /><circle cx="14" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="10" cy="18" r="1.4" fill="currentColor" stroke="none" /></>,
  pdf: <><path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v4h4" /><path d="M9 13h1.5a1.5 1.5 0 0 1 0 3H9v-3zM9 16v2" opacity=".9" /></>,
  // Robot with headphones for the assistant button (matches the requested look)
  book: (
    <>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H10a2 2 0 0 1 2 2v14a1.75 1.75 0 0 0-1.75-1.75H5.5A1.5 1.5 0 0 1 4 15.75z" />
      <path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H14a2 2 0 0 0-2 2v14a1.75 1.75 0 0 1 1.75-1.75h4.75A1.5 1.5 0 0 0 20 15.75z" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  robot: (
    <>
      <circle cx="12" cy="3.4" r="1.15" fill="currentColor" stroke="none" />
      <path d="M12 4.5v1.6" />
      <path d="M5.5 11.5V11a6.5 6.5 0 0 1 13 0v.5" />
      <rect x="3" y="10.6" width="2.4" height="4.2" rx="1.2" />
      <rect x="18.6" y="10.6" width="2.4" height="4.2" rx="1.2" />
      <rect x="6" y="6.2" width="12" height="10.4" rx="3" />
      <circle cx="9.7" cy="11" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="14.3" cy="11" r="1.15" fill="currentColor" stroke="none" />
      <path d="M9.6 13.4a3 3 0 0 0 4.8 0" />
      <path d="M10.5 16.6l-1.3 3 3-2.1" />
    </>
  ),
};

export default function Icon({ name, size = 16, className }) {
  const body = PATHS[name];
  if (!body) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...P}
    >
      {body}
    </svg>
  );
}
