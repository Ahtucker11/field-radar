"use client";

import type { Tier, Location, Source } from "@/lib/types";

export type Filters = {
  tiers: Set<Tier>;
  locations: Set<Location>;
  sources: Set<Source>;
  showPast: boolean;
};

type Props = {
  filters: Filters;
  onChange: (next: Filters) => void;
};

const TIERS: Tier[] = ["tier-1", "tier-2", "tier-3"];
const LOCATIONS: Location[] = ["loc-chi", "loc-cin", "loc-cmh", "loc-ind", "loc-rec"];
const SOURCES: Source[] = ["manual", "scout"];

const LOCATION_LABELS: Record<Location, string> = {
  "loc-chi": "Chicago",
  "loc-cin": "Cincinnati",
  "loc-cmh": "Columbus",
  "loc-ind": "Indianapolis",
  "loc-rec": "Recurring",
};

function Pill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: "6px 12px",
        borderRadius: 20,
        border: "1.5px solid var(--green)",
        background: active ? "var(--green)" : "#fff",
        color: active ? "var(--cream)" : "var(--text)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function FilterBar({ filters, onChange }: Props) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--green)",
        borderRadius: "var(--r-md)",
        padding: "14px 18px",
        marginBottom: 20,
        boxShadow: "var(--shadow-card)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <Row label="Tier">
        {TIERS.map((t) => (
          <Pill
            key={t}
            active={filters.tiers.has(t)}
            label={t.replace("tier-", "T")}
            onClick={() => onChange({ ...filters, tiers: toggle(filters.tiers, t) })}
          />
        ))}
      </Row>
      <Row label="Location">
        {LOCATIONS.map((l) => (
          <Pill
            key={l}
            active={filters.locations.has(l)}
            label={LOCATION_LABELS[l]}
            onClick={() => onChange({ ...filters, locations: toggle(filters.locations, l) })}
          />
        ))}
      </Row>
      <Row label="Source">
        {SOURCES.map((s) => (
          <Pill
            key={s}
            active={filters.sources.has(s)}
            label={s === "manual" ? "Manual" : "Scout"}
            onClick={() => onChange({ ...filters, sources: toggle(filters.sources, s) })}
          />
        ))}
      </Row>
      <Row label="Time">
        <Pill
          active={filters.showPast}
          label={filters.showPast ? "Showing past" : "Past hidden"}
          onClick={() => onChange({ ...filters, showPast: !filters.showPast })}
        />
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <span
        className="mono"
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: "var(--text-muted)",
          minWidth: 70,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
