"use client";

import { useEffect, useState } from "react";
import type { EventDb, EventCreate } from "@/lib/types";

type Props = {
  open: boolean;
  initial?: EventDb | null;
  defaultStartDate?: string;
  adminKey: string | null;
  onClose: () => void;
  onSaved: () => void;
};

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
        <h3 className="display" style={{ fontSize: 20, marginBottom: 16 }}>
          {initial ? "Edit Event" : "Add Event"}
        </h3>

        {initial && initial.source === "scout" && !initial.confirmed && (
          <div
            style={{
              background: "var(--green-pale)",
              border: "1px dashed var(--green)",
              padding: "8px 12px",
              borderRadius: "var(--r-sm)",
              marginBottom: 12,
              fontSize: 12,
            }}
          >
            Scout found this. Confirm if it&apos;s a real event, or dismiss to remove.
          </div>
        )}

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
          {initial && initial.source === "scout" && !initial.confirmed && (
            <button onClick={confirmEvent} disabled={busy} style={primaryBtnStyle}>
              Confirm
            </button>
          )}
          {initial && (
            <button onClick={dismiss} disabled={busy} style={dangerBtnStyle}>
              Dismiss
            </button>
          )}
          <button onClick={onClose} disabled={busy} style={secondaryBtnStyle}>
            Cancel
          </button>
          <button onClick={save} disabled={busy} style={primaryBtnStyle}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
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
