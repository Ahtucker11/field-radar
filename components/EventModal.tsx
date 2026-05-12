"use client";

import { useEffect, useState } from "react";
import type { EventDb, EventCreate, Tier, Location } from "@/lib/types";

type Props = {
  open: boolean;
  initial?: EventDb | null;
  defaultStartDate?: string;
  adminKey: string | null;
  onClose: () => void;
  onSaved: () => void;
};

type Mode = "view" | "edit";

const TIER_BG: Record<Tier, string> = {
  "tier-1": "var(--green-light)",
  "tier-2": "var(--orange)",
  "tier-3": "#8a8170",
};

const TIER_LABEL: Record<Tier, string> = {
  "tier-1": "T1 — Drop everything",
  "tier-2": "T2 — Worth the time",
  "tier-3": "T3 — Awareness",
};

const LOC_LABEL: Record<Location, string> = {
  "loc-chi": "Chicago",
  "loc-cin": "Cincinnati",
  "loc-cmh": "Columbus",
  "loc-ind": "Indianapolis",
  "loc-rec": "Recurring / Action",
};

function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatRange(startISO: string, endISO?: string | null): string {
  const start = parseISODate(startISO);
  const end = endISO ? parseISODate(endISO) : start;
  const sameDay = start.getTime() === end.getTime();
  const sameYear = start.getFullYear() === end.getFullYear();
  const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
  if (sameDay) {
    return start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }
  const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startStr} → ${endStr}`;
}

function makeBlank(start?: string): EventCreate {
  return {
    name: "",
    label: "",
    start_date: start ?? new Date().toISOString().slice(0, 10),
    end_date: "",
    tier: "tier-2",
    location: "loc-cin",
    notes: "",
    url: "",
  };
}

export function EventModal({ open, initial, defaultStartDate, adminKey, onClose, onSaved }: Props) {
  const [form, setForm] = useState<EventCreate>(() => makeBlank(defaultStartDate));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("edit");

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              name: initial.name,
              label: initial.label ?? "",
              start_date: initial.start_date,
              end_date: initial.end_date ?? "",
              tier: initial.tier,
              location: initial.location,
              notes: initial.notes ?? "",
              url: initial.url ?? "",
            }
          : makeBlank(defaultStartDate),
      );
      setError(null);
      setMode(initial ? "view" : "edit");
    }
  }, [open, initial, defaultStartDate]);

  if (!open) return null;

  async function save() {
    if (!adminKey) {
      setError("Admin key required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const path = initial ? `/api/events/${initial.id}` : "/api/events";
      const method = initial ? "PATCH" : "POST";
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEvent() {
    if (!initial || !adminKey) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify({ confirmed: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "confirm failed");
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    if (!initial || !adminKey) return;
    if (!confirm("Dismiss this event?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${initial.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "dismiss failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,31,26,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fr-modal"
        style={{
          background: "var(--cream)",
          border: "1px solid var(--green)",
          borderRadius: "var(--r-md)",
          padding: "22px 24px",
          maxWidth: 500,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "6px 6px 0 var(--green)",
        }}
      >
        {/* Top icon bar — close (always), edit pencil (only when viewing an existing event) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          {initial && mode === "view" ? (
            <span
              className="mono"
              style={{
                background: TIER_BG[initial.tier],
                color: "#fff",
                fontSize: 10,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 3,
                letterSpacing: 0.5,
              }}
            >
              {TIER_LABEL[initial.tier]}
            </span>
          ) : (
            <h3 className="display" style={{ fontSize: 20 }}>
              {initial ? "Edit event" : "Add event"}
            </h3>
          )}

          <div style={{ display: "flex", gap: 4 }}>
            {initial && mode === "view" && (
              <button
                onClick={() => setMode("edit")}
                title="Edit"
                aria-label="Edit"
                style={iconBtnStyle}
              >
                <PencilIcon />
              </button>
            )}
            <button onClick={onClose} title="Close" aria-label="Close" style={iconBtnStyle}>
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* VIEW MODE */}
        {initial && mode === "view" && (
          <>
            <div className="display" style={{ fontSize: 24, lineHeight: 1.2, marginBottom: 8 }}>
              {initial.name}
            </div>

            <div
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 4,
              }}
            >
              {formatRange(initial.start_date, initial.end_date)}
            </div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 16,
              }}
            >
              {LOC_LABEL[initial.location]}
            </div>

            <div style={{ height: 1, background: "var(--border-soft)", margin: "12px 0 14px" }} />

            {initial.notes && (
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-soft, #4a4f4a)", marginBottom: 14, whiteSpace: "pre-wrap" }}>
                {initial.notes}
              </p>
            )}

            {initial.url && (
              <a
                href={initial.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  fontSize: 12,
                  color: "var(--green)",
                  textDecoration: "underline",
                  wordBreak: "break-all",
                  marginBottom: 14,
                }}
              >
                {initial.url} ↗
              </a>
            )}

            {initial.source === "scout" && !initial.confirmed && (
              <div
                style={{
                  background: "var(--green-pale)",
                  border: "1px dashed var(--green)",
                  padding: "10px 12px",
                  borderRadius: "var(--r-sm)",
                  marginBottom: 14,
                  fontSize: 12,
                  color: "var(--text-soft, #4a4f4a)",
                }}
              >
                <strong style={{ color: "var(--green)" }}>Scout-found.</strong>{" "}
                Confirm if this is a real event, or dismiss to remove it from future suggestions.
              </div>
            )}

            {error && <div style={{ color: "#a51c1c", fontSize: 12, marginBottom: 8 }}>{error}</div>}

            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button onClick={dismiss} disabled={busy} style={dangerBtnStyle}>
                Dismiss
              </button>
              {initial.source === "scout" && !initial.confirmed && (
                <button onClick={confirmEvent} disabled={busy} style={primaryBtnStyle}>
                  {busy ? "…" : "Confirm"}
                </button>
              )}
            </div>
          </>
        )}

        {/* EDIT MODE (also handles add) */}
        {mode === "edit" && (
          <>
            <Field label="Name">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="Label (calendar pill)">
              <input
                value={form.label ?? ""}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Row>
              <Field label="Start">
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  style={inputStyle}
                />
              </Field>
              <Field label="End (optional)">
                <input
                  type="date"
                  value={form.end_date ?? ""}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  style={inputStyle}
                />
              </Field>
            </Row>
            <Row>
              <Field label="Tier">
                <select
                  value={form.tier}
                  onChange={(e) => setForm({ ...form, tier: e.target.value as EventCreate["tier"] })}
                  style={inputStyle}
                >
                  <option value="tier-1">T1 — Drop everything</option>
                  <option value="tier-2">T2 — Worth the time</option>
                  <option value="tier-3">T3 — Awareness</option>
                </select>
              </Field>
              <Field label="Location">
                <select
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value as EventCreate["location"] })}
                  style={inputStyle}
                >
                  <option value="loc-chi">Chicago</option>
                  <option value="loc-cin">Cincinnati</option>
                  <option value="loc-cmh">Columbus</option>
                  <option value="loc-ind">Indianapolis</option>
                  <option value="loc-rec">Recurring / Action</option>
                </select>
              </Field>
            </Row>
            <Field label="Notes">
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                style={{ ...inputStyle, minHeight: 60 }}
              />
            </Field>
            <Field label="URL">
              <input
                type="url"
                value={form.url ?? ""}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                style={inputStyle}
              />
            </Field>

            {error && <div style={{ color: "#a51c1c", fontSize: 12, marginTop: 8 }}>{error}</div>}

            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {initial && (
                <button onClick={dismiss} disabled={busy} style={dangerBtnStyle}>
                  Dismiss
                </button>
              )}
              <button
                onClick={() => (initial ? setMode("view") : onClose())}
                disabled={busy}
                style={secondaryBtnStyle}
              >
                Cancel
              </button>
              <button onClick={save} disabled={busy} style={primaryBtnStyle}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--green)",
  borderRadius: "var(--r-sm)",
  fontSize: 13,
  background: "#fff",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "7px 14px",
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 1,
  background: "var(--green)",
  color: "var(--cream)",
  border: "1.5px solid var(--green)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: "#fff",
  color: "var(--text)",
};

const dangerBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: "#fff",
  color: "#a51c1c",
  borderColor: "#a51c1c",
};

const iconBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 6,
  cursor: "pointer",
  color: "var(--text-muted)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--r-sm)",
  lineHeight: 0,
};

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        className="mono"
        style={{
          display: "block",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: "var(--text-muted)",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="fr-modal-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>;
}
