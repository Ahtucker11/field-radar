"use client";

import { useEffect, useState, useCallback } from "react";
import type { EventDb, Tier, Location, Source } from "@/lib/types";
import { Calendar } from "@/components/Calendar";
import { EventModal } from "@/components/EventModal";
import { FilterBar, type Filters } from "@/components/FilterBar";
import { TodayBanner } from "@/components/TodayBanner";
import { AdminPanel } from "@/components/AdminPanel";

const ADMIN_KEY_STORAGE = "field-radar-admin-key";

const ALL_TIERS: Tier[] = ["tier-1", "tier-2", "tier-3"];
const ALL_LOCATIONS: Location[] = ["loc-chi", "loc-cin", "loc-cmh", "loc-ind", "loc-rec"];
const ALL_SOURCES: Source[] = ["manual", "scout"];

export default function HomePage() {
  const [events, setEvents] = useState<EventDb[]>([]);
  const [filters, setFilters] = useState<Filters>({
    tiers: new Set(ALL_TIERS),
    locations: new Set(ALL_LOCATIONS),
    sources: new Set(ALL_SOURCES),
    showPast: true,
  });
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [modalEvent, setModalEvent] = useState<EventDb | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (stored) setAdminKey(stored);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/events", { cache: "no-store" });
    const body = await res.json();
    setEvents(body.events ?? []);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleSetKey(key: string | null) {
    if (key) {
      sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
      setAdminKey(key);
    } else {
      sessionStorage.removeItem(ADMIN_KEY_STORAGE);
      setAdminKey(null);
    }
  }

  async function scanNow() {
    if (!adminKey) return;
    const res = await fetch("/api/scout/trigger", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminKey}` },
    });
    if (!res.ok) {
      alert(`Scout trigger failed: ${res.status}`);
      return;
    }
    await refresh();
  }

  const unconfirmed = events.filter((e) => e.source === "scout" && !e.confirmed).length;

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto" }}>
      <header
        style={{
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 className="display fr-h1" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.5px" }}>
            Field Radar
          </h1>
          <div
            className="mono fr-subtitle"
            style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}
          >
            Midwest events // Chicago · Cincinnati · Columbus · Indianapolis
          </div>
        </div>
        <AdminPanel
          adminKey={adminKey}
          onSetKey={handleSetKey}
          onScanNow={scanNow}
          onAddEvent={() => {
            setModalEvent(null);
            setModalOpen(true);
          }}
        />
      </header>

      <TodayBanner events={events} unconfirmedCount={unconfirmed} lastScoutAt={null} />
      <FilterBar filters={filters} onChange={setFilters} />
      <Calendar
        events={events}
        filters={filters}
        onEventClick={(e) => {
          setModalEvent(e);
          setModalOpen(true);
        }}
      />

      <EventModal
        open={modalOpen}
        initial={modalEvent}
        adminKey={adminKey}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
      />
    </main>
  );
}
