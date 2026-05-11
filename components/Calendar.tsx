"use client";

import type { EventDb, Tier, Location } from "@/lib/types";
import type { Filters } from "@/components/FilterBar";

const TIER_BG: Record<Tier, string> = {
  "tier-1": "var(--green-light)",
  "tier-2": "var(--orange)",
  "tier-3": "#8a8170",
};

const LOC_BORDER: Record<Location, string> = {
  "loc-chi": "#74a4d4",
  "loc-cin": "#fc8181",
  "loc-cmh": "#b794f4",
  "loc-ind": "#f6e05e",
  "loc-rec": "#9ac4a8",
};

type Props = {
  events: EventDb[];
  filters: Filters;
  onEventClick: (event: EventDb) => void;
  isMobile?: boolean;
};

const DAY_NAMES_DESKTOP = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_MOBILE = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const VISIBLE_DAYS_DESKTOP = [0, 1, 2, 3, 4, 5, 6];
const VISIBLE_DAYS_MOBILE = [1, 2, 3, 4, 5];

type WeekCell =
  | { type: "empty" }
  | { type: "day"; date: Date; dayNum: number; dow: number };

type Week = { cells: WeekCell[]; id: string };

type LaidOutEvent = {
  event: EventDb;
  startCol: number;
  span: number;
  lane: number;
};

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isVisible(ev: EventDb, filters: Filters, today: Date): boolean {
  if (!filters.tiers.has(ev.tier)) return false;
  if (!filters.locations.has(ev.location)) return false;
  if (!filters.sources.has(ev.source)) return false;
  if (!filters.showPast) {
    const end = parseDate(ev.end_date ?? ev.start_date);
    if (end < today && !isSameDay(end, today)) return false;
  }
  return true;
}

function buildWeeks(year: number, month: number, visibleDays: number[], isMobile: boolean): Week[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const numCols = visibleDays.length;
  const startOfWeek = isMobile ? 1 : 0; // Mon=1 for mobile, Sun=0 for desktop

  const weeks: Week[] = [];
  let currentWeek: WeekCell[] = [];
  let weekIdx = 0;

  const offsetToStart = (firstDay.getDay() - startOfWeek + 7) % 7;

  const cursor = new Date(firstDay);
  cursor.setDate(cursor.getDate() - offsetToStart);

  // Hard safety cap (max ~42 calendar days walked)
  let safety = 0;
  while ((cursor <= lastDay || currentWeek.length > 0) && safety < 80) {
    safety += 1;
    const dow = cursor.getDay();
    if (visibleDays.includes(dow)) {
      if (cursor < firstDay || cursor > lastDay) {
        currentWeek.push({ type: "empty" });
      } else {
        currentWeek.push({
          type: "day",
          date: new Date(cursor),
          dayNum: cursor.getDate(),
          dow,
        });
      }
      if (currentWeek.length === numCols) {
        weeks.push({ cells: currentWeek, id: `${year}-${month}-w${weekIdx++}` });
        currentWeek = [];
        // If cursor is past lastDay, we're done — no more weeks to start
        if (cursor > lastDay) break;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < numCols) currentWeek.push({ type: "empty" });
    weeks.push({ cells: currentWeek, id: `${year}-${month}-w${weekIdx++}` });
  }

  return weeks;
}

function placeEventInWeek(event: EventDb, week: Week): { startCol: number; span: number } | null {
  const evStart = parseDate(event.start_date);
  const evEnd = event.end_date ? parseDate(event.end_date) : evStart;

  let startIdx = -1;
  let endIdx = -1;
  for (let i = 0; i < week.cells.length; i++) {
    const cell = week.cells[i];
    if (cell.type !== "day") continue;
    if (cell.date >= evStart && cell.date <= evEnd) {
      if (startIdx === -1) startIdx = i;
      endIdx = i;
    }
  }

  if (startIdx === -1) return null;
  return { startCol: startIdx + 1, span: endIdx - startIdx + 1 };
}

function layoutWeek(events: EventDb[], week: Week): LaidOutEvent[] {
  const placements = events
    .map((e) => ({ event: e, place: placeEventInWeek(e, week) }))
    .filter((p): p is { event: EventDb; place: { startCol: number; span: number } } => p.place !== null);

  // Sort by startCol ascending; tie-break by longer span first so big events sit on lower lanes
  placements.sort((a, b) => {
    if (a.place.startCol !== b.place.startCol) return a.place.startCol - b.place.startCol;
    return b.place.span - a.place.span;
  });

  const lanes: number[][] = []; // each lane holds endCols claimed so far
  const result: LaidOutEvent[] = [];

  for (const { event, place } of placements) {
    const startCol = place.startCol;
    const endCol = startCol + place.span - 1;
    let laneIdx = lanes.findIndex((lane) => lane.every((c) => c < startCol));
    if (laneIdx === -1) {
      laneIdx = lanes.length;
      lanes.push([]);
    }
    lanes[laneIdx].push(endCol);
    result.push({ event, startCol, span: place.span, lane: laneIdx });
  }

  return result;
}

export function Calendar({ events, filters, onEventClick, isMobile = false }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (events.length === 0) {
    return <Empty>No events yet. Add one or run the scout.</Empty>;
  }

  const allDates = events.flatMap((e) => [parseDate(e.start_date), parseDate(e.end_date ?? e.start_date)]);
  allDates.push(today);
  const min = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const max = new Date(Math.max(...allDates.map((d) => d.getTime())));

  const months: { year: number; month: number }[] = [];
  const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
  const last = new Date(max.getFullYear(), max.getMonth(), 1);
  while (cursor <= last) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <>
      {months.map(({ year, month }) => (
        <Month
          key={`${year}-${month}`}
          year={year}
          month={month}
          events={events}
          filters={filters}
          today={today}
          onEventClick={onEventClick}
          isMobile={isMobile}
        />
      ))}
    </>
  );
}

function Month({
  year,
  month,
  events,
  filters,
  today,
  onEventClick,
  isMobile,
}: {
  year: number;
  month: number;
  events: EventDb[];
  filters: Filters;
  today: Date;
  onEventClick: (event: EventDb) => void;
  isMobile: boolean;
}) {
  const firstDay = new Date(year, month, 1);
  const monthName = firstDay.toLocaleDateString("en-US", { month: "long" });

  const visibleDays = isMobile ? VISIBLE_DAYS_MOBILE : VISIBLE_DAYS_DESKTOP;
  const dayNames = isMobile ? DAY_NAMES_MOBILE : DAY_NAMES_DESKTOP;
  const numCols = visibleDays.length;

  const weeks = buildWeeks(year, month, visibleDays, isMobile);
  const visibleEvents = events.filter((e) => isVisible(e, filters, today));

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--green)",
        borderRadius: "var(--r-md)",
        marginBottom: 24,
        overflow: "hidden",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="display fr-month-header"
        style={{
          background: "var(--green)",
          color: "var(--cream)",
          padding: "12px 18px",
          fontSize: 20,
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span>{monthName}</span>
        <span className="mono" style={{ fontSize: 11, fontWeight: 400, letterSpacing: 1, opacity: 0.7 }}>
          {year}
        </span>
      </div>

      {/* Day-name header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${numCols}, 1fr)`,
          gap: 1,
          background: "var(--green)",
          borderTop: "1px solid var(--green)",
        }}
      >
        {dayNames.map((d, i) => (
          <div
            key={d}
            className="mono fr-day-name"
            style={{
              background: "#ede8da",
              padding: "8px 10px",
              fontSize: 10,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--text-muted)",
              gridColumn: i + 1,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week) => (
        <WeekRow
          key={week.id}
          week={week}
          numCols={numCols}
          events={visibleEvents}
          today={today}
          onEventClick={onEventClick}
        />
      ))}
    </div>
  );
}

function WeekRow({
  week,
  numCols,
  events,
  today,
  onEventClick,
}: {
  week: Week;
  numCols: number;
  events: EventDb[];
  today: Date;
  onEventClick: (event: EventDb) => void;
}) {
  const laidOut = layoutWeek(events, week);
  const laneCount = laidOut.reduce((max, le) => Math.max(max, le.lane + 1), 0);

  // Single grid per week: row 1 = day numbers, rows 2..N+1 = event lanes, row N+2 = small bottom pad.
  // Empty weeks collapse to just the day-number strip.
  const gridRows =
    laneCount > 0
      ? `28px repeat(${laneCount}, 20px) 6px`
      : `28px`;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${numCols}, 1fr)`,
        gridTemplateRows: gridRows,
        columnGap: 1,
        rowGap: 0,
        background: "var(--green)",
        borderTop: "1px solid var(--green)",
      }}
    >
      {/* Cell backgrounds span all rows of the week (day strip + lanes) */}
      {week.cells.map((cell, i) => {
        const isToday = cell.type === "day" && isSameDay(cell.date, today);
        const isPast = cell.type === "day" && cell.date < today && !isToday;
        const isWeekend = cell.type === "day" && (cell.dow === 0 || cell.dow === 6);
        const bg =
          cell.type === "empty"
            ? "#f5f1e6"
            : isToday
              ? "#fff4e6"
              : isPast
                ? "var(--bg-aged)"
                : isWeekend
                  ? "#fbf8f0"
                  : "#fff";
        return (
          <div
            key={`bg-${i}`}
            style={{
              gridColumn: i + 1,
              gridRow: "1 / -1",
              background: bg,
              boxShadow: isToday ? "inset 0 0 0 3px var(--orange)" : undefined,
            }}
          />
        );
      })}

      {/* Day numbers — row 1 of each column */}
      {week.cells.map((cell, i) => (
        <div
          key={`num-${i}`}
          className="fr-day"
          style={{
            gridColumn: i + 1,
            gridRow: 1,
            padding: "6px 5px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {cell.type === "day" && (
            <div
              className="mono fr-day-num"
              style={{
                fontSize: 11,
                color: cell.date.getTime() === today.getTime() ? "#fff" : "var(--text-muted)",
                background: cell.date.getTime() === today.getTime() ? "var(--orange)" : "transparent",
                display: "inline-block",
                padding: cell.date.getTime() === today.getTime() ? "2px 6px" : 0,
                borderRadius: 3,
                fontWeight: cell.date.getTime() === today.getTime() ? 700 : 400,
              }}
            >
              {cell.dayNum}
            </div>
          )}
        </div>
      ))}

      {/* Event pills — rows 2..N+1 */}
      {laidOut.map((le) => {
        const evEnd = parseDate(le.event.end_date ?? le.event.start_date);
        const isPastEvent = evEnd < today && !isSameDay(evEnd, today);
        return (
          <button
            key={`${le.event.id}-${week.id}`}
            onClick={() => onEventClick(le.event)}
            title={`${le.event.name}${le.event.notes ? "\n\n" + le.event.notes : ""}`}
            className="fr-event-pill"
            style={{
              gridColumn: `${le.startCol} / span ${le.span}`,
              gridRow: le.lane + 2,
              margin: "0 3px",
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 3,
              color: "#fff",
              background: TIER_BG[le.event.tier],
              border: "none",
              borderLeft: `3px ${le.event.source === "scout" && !le.event.confirmed ? "dashed" : "solid"} ${LOC_BORDER[le.event.location]}`,
              cursor: "pointer",
              textAlign: "left",
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              position: "relative",
              zIndex: 2,
              opacity: isPastEvent ? 0.55 : 1,
            }}
          >
            {le.event.source === "scout" && !le.event.confirmed ? "~ " : ""}
            {le.event.label ?? le.event.name}
          </button>
        );
      })}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 30,
        textAlign: "center",
        color: "var(--text-muted)",
        fontSize: 13,
        background: "#fff",
        border: "1px solid var(--green)",
        borderRadius: "var(--r-md)",
      }}
    >
      {children}
    </div>
  );
}
