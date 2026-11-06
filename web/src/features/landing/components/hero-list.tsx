import type { StatusCategory } from "@mytask/core";

import { sampleTasks } from "../lib/sample-tasks";

const ROW = 56;
const WIDTH = 1200;

/** Tasks, sub-tasks and linked tasks from the sample, flattened into the rows of one long list. */
function rows() {
  const out: { key: string; title: string; status: StatusCategory }[] = [];
  for (const t of sampleTasks()) {
    out.push({ key: t.key, title: t.title, status: t.statusCategory });
    for (const s of t.subtasks ?? [])
      out.push({ key: s.key, title: s.title, status: s.statusCategory });
    for (const l of t.links ?? [])
      if (l.statusCategory) out.push({ key: l.key, title: l.title, status: l.statusCategory });
  }
  // Short titles only: a long one would run past the column and catch the eye.
  return out.filter((r) => r.title.length <= 44).slice(0, 18);
}

const ages = ["2m", "12m", "40m", "1h", "3h", "5h", "1d", "2d", "3d", "1w"];

/**
 * The hero's backdrop: the product's own list, drawn very faint behind the headline so the page says what the app
 * is before a word is read. SVG text, one image to nobody (aria-hidden); it fades out around the head and at the edges.
 */
export function HeroList() {
  const list = rows();
  const height = list.length * ROW;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${WIDTH} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full text-ink opacity-[0.07] [mask-image:radial-gradient(ellipse_46%_40%_at_50%_50%,transparent_55%,var(--color-ink)_100%),linear-gradient(to_bottom,transparent,var(--color-ink)_20%,var(--color-ink)_70%,transparent)] [mask-composite:intersect]"
    >
      {list.map((r, i) => {
        const y = i * ROW;
        const mid = y + ROW / 2;
        return (
          <g key={`${r.key}-${i}`}>
            <line
              x1="0"
              x2={WIDTH}
              y1={y + ROW}
              y2={y + ROW}
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx="40"
              cy={mid}
              r="7"
              fill={r.status === "done" ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray={r.status === "todo" ? "3 3" : undefined}
            />
            {r.status === "in_progress" && <circle cx="40" cy={mid} r="2.5" fill="currentColor" />}
            <text
              x="68"
              y={mid + 5}
              fill="currentColor"
              fontFamily="var(--font-mono)"
              fontSize="14"
              opacity="0.7"
            >
              {r.key}
            </text>
            <text
              x="240"
              y={mid + 5}
              fill="currentColor"
              fontFamily="var(--font-display)"
              fontSize="16"
              fontWeight="500"
            >
              {r.title}
            </text>
            <text
              x={WIDTH - 40}
              y={mid + 5}
              fill="currentColor"
              fontFamily="var(--font-body)"
              fontSize="13"
              opacity="0.6"
              textAnchor="end"
            >
              {ages[i % ages.length]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
