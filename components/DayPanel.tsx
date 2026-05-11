"use client";

import type { EventDb, Tier, Location } from "@/lib/types";

const TIER_BG: Record<Tier, string> = {
  "tier-1": "var(--green-light)",
  "tier-2": "var(--orange)",
  "tier-3": "#8a8170",
};

const TIER_LABEL: Record<Tier, string> = {
  "tier-1": "T1",
  "tier-2": "T2",
  "tier-3": "T3",
};

const LOC_LABEL: Record<Location, string> = {
  "loc-chi": "Chicago",
  "loc-cin": "Cincinnati",
  "loc-cmh": "Columbus",
  "loc-ind": "Indianapolis",
  "loc-rec": "Recurring",
};

type Props = {
  date: Date | null;
  events: EventDb[];
  onClose: () => void;
  onSelectEvent: (event: EventDb) => void;
  onAddEvent: () => void;
};

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatShortRange(start: Date, end: Date): string {
  const sameDay = start.getTime() === end.getTime();
  if (sameDay) {
    return start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function eventCoversDay(ev: EventDb, day: Date): boolean {
  const start = parseDate(ev.start_date);
  const end = ev.end_date ? parseDate(ev.end_date) : start;
  return day >= start && day <= end;
}

export function DayPanel({ date, events, onClose, onSelectEvent, onAddEvent }: Props) {
  if (!date) return null;

  const dayEvents = events.filter((e) => eventCoversDay(e, date));

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,31,26,0.6)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 90,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--cream)",
          border: "1px solid var(--green)",
          borderRadius: "var(--r-md) var(--r-md) 0 0",
          padding: "18px 18px 24px",
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 -6px 0 var(--green)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <h3 className="display" style={{ fontSize: 18 }}>
            {formatDayHeader(date)}
          </h3>
          <button
            onClick={onClose}
            className="mono"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1,
              cursor: "pointer",
              padding: 4,
            }}
          >
            Close
          </button>
        </div>

        {dayEvents.length === 0 ? (
          <div
            style={{
              padding: "16px 0",
              color: "var(--text-muted)",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            No events on this day.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {dayEvents.map((ev) => {
              const start = parseDate(ev.start_date);
              const end = ev.end_date ? parseDate(ev.end_date) : start;
              const isUnconfirmedScout = ev.source === "scout" && !ev.confirmed;
              return (
                <button
                  key={ev.id}
                  onClick={() => onSelectEvent(ev)}
                  style={{
                    background: "#fff",
                    border: `1px solid ${isUnconfirmedScout ? "#a14a0c" : "var(--green)"}`,
                    borderLeft: `4px solid ${TIER_BG[ev.tier]}`,
                    borderRadius: "var(--r-sm)",
                    padding: "10px 12px",
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {isUnconfirmedScout && <span style={{ color: "var(--orange)", marginRight: 4 }}>~</span>}
                      {ev.name}
                    </div>
                    <span
                      className="mono"
                      style={{
                        fontSize: 9,
                        background: TIER_BG[ev.tier],
                        color: "#fff",
                        padding: "1px 5px",
                        borderRadius: 2,
                        marginLeft: 8,
                        flexShrink: 0,
                      }}
                    >
                      {TIER_LABEL[ev.tier]}
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: ev.notes || ev.url ? 6 : 0 }}>
                    {formatShortRange(start, end)} · {LOC_LABEL[ev.location]}
                    {isUnconfirmedScout && <span style={{ marginLeft: 6, color: "var(--orange)" }}>scout-found</span>}
                  </div>
                  {ev.notes && (
                    <div style={{ fontSize: 12, color: "var(--text-soft, #4a4f4a)", lineHeight: 1.4 }}>
                      {ev.notes}
                    </div>
                  )}
                  {ev.url && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, wordBreak: "break-all" }}>
                      {ev.url}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={onAddEvent}
          style={{
            marginTop: 14,
            width: "100%",
            padding: "10px 14px",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 1,
            background: "var(--green)",
            color: "var(--cream)",
            border: "1.5px solid var(--green)",
            borderRadius: "var(--r-sm)",
            cursor: "pointer",
          }}
        >
          + Add event on {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </button>
      </div>
    </div>
  );
}
