"use client";

import type { EventDb, Tier, Location, Source } from "@/lib/types";
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
};

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayInEvent(day: Date, ev: EventDb): boolean {
  const start = parseDate(ev.start_date);
  const end = ev.end_date ? parseDate(ev.end_date) : start;
  return day >= start && day <= end;
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

export function Calendar({ events, filters, onEventClick }: Props) {
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
  let cursor = new Date(min.getFullYear(), min.getMonth(), 1);
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
}: {
  year: number;
  month: number;
  events: EventDb[];
  filters: Filters;
  today: Date;
  onEventClick: (event: EventDb) => void;
}) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstDow = firstDay.getDay();
  const monthName = firstDay.toLocaleDateString("en-US", { month: "long" });

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push(<div key={`e${i}`} style={{ ...dayStyle, background: "#f5f1e6" }} />);
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const day = new Date(year, month, d);
    const isToday = isSameDay(day, today);
    const isPast = day < today && !isToday;
    const dayEvents = events.filter((e) => dayInEvent(day, e) && isVisible(e, filters, today));
    cells.push(
      <div
        key={d}
        className="fr-day"
        style={{
          ...dayStyle,
          background: isToday ? "#fff4e6" : day.getDay() === 0 || day.getDay() === 6 ? "#fbf8f0" : "#fff",
          boxShadow: isToday ? "inset 0 0 0 3px var(--orange)" : undefined,
          opacity: isPast ? 0.55 : 1,
        }}
      >
        <div
          className="mono fr-day-num"
          style={{
            fontSize: 11,
            color: isToday ? "#fff" : "var(--text-muted)",
            background: isToday ? "var(--orange)" : "transparent",
            display: "inline-block",
            padding: isToday ? "2px 6px" : 0,
            borderRadius: 3,
            fontWeight: isToday ? 700 : 400,
            marginBottom: 4,
          }}
        >
          {d}
        </div>
        {dayEvents.map((ev) => (
          <button
            key={ev.id}
            onClick={() => onEventClick(ev)}
            title={`${ev.name}${ev.notes ? "\n\n" + ev.notes : ""}`}
            className="fr-event-pill"
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "3px 6px",
              borderRadius: 3,
              marginBottom: 2,
              color: "#fff",
              background: TIER_BG[ev.tier],
              border: "none",
              borderLeft: `3px ${ev.source === "scout" && !ev.confirmed ? "dashed" : "solid"} ${LOC_BORDER[ev.location]}`,
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              lineHeight: 1.25,
            }}
          >
            {ev.source === "scout" && !ev.confirmed ? "~ " : ""}
            {ev.label ?? ev.name}
          </button>
        ))}
      </div>,
    );
  }

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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 1,
          background: "var(--green)",
          borderTop: "1px solid var(--green)",
        }}
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
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
            }}
          >
            {d}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}

const dayStyle: React.CSSProperties = {
  minHeight: 100,
  padding: "6px 5px",
  display: "flex",
  flexDirection: "column",
  background: "#fff",
};

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
