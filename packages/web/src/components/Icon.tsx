import type { SVGProps } from "react";

const paths = {
  shield: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z M8.5 12l2.5 2.5 4.5-5",
  key: "M15 14a5 5 0 1 0-5-5 M10 9l-7 7v5h5v-3h3v-3l1-1 M16 7h.01",
  spark: "m13 2-9 12h7l-1 8 10-12h-7l1-8Z",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  search: "M21 21l-4.5-4.5 M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  sun: "M12 3V1 M12 23v-2 M3 12H1 M23 12h-2 M5 5 3.5 3.5 M20.5 20.5 19 19 M5 19l-1.5 1.5 M20.5 3.5 19 5 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  moon: "M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z",
  logout: "M9 4H4v16h5 M14 8l4 4-4 4 M8 12h13",
  arrow: "M5 12h14 M14 7l5 5-5 5",
  chevron: "m6 9 6 6 6-6",
  plus: "M12 5v14 M5 12h14",
  check: "m5 12 4 4L19 6",
  copy: "M9 9h11v11H9V9Z M15 5V3H3v12h2",
  download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
  lock: "M5 10h14v11H5V10Z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3",
  home: "m3 10 9-7 9 7 M5 9v12h14V9 M9 21v-8h6v8",
  layers: "m12 3 10 6-10 6L2 9l10-6Z M2 13l10 6 10-6 M2 17l10 6 10-6",
  light: "M9 18h6 M10 22h4 M8 14a6 6 0 1 1 8 0l-1 4H9l-1-4Z",
  close: "m6 6 12 12 M6 18 18 6",
  alert:
    "M12 8v5 M12 17h.01 M10 3 2 18a2 2 0 0 0 2 3h16a2 2 0 0 0 2-3L14 3a2 2 0 0 0-4 0Z",
  refresh:
    "M20 7V3 M20 7h-4 M4 17v4 M4 17h4 M4 9a8 8 0 0 1 14-5l2 3 M20 15a8 8 0 0 1-14 5l-2-3",
};

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
