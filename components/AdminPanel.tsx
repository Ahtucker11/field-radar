"use client";

import { useState } from "react";

type Props = {
  adminKey: string | null;
  onSetKey: (key: string | null) => void;
  onScanNow: () => Promise<void>;
  onAddEvent: () => void;
};

export function AdminPanel({ adminKey, onSetKey, onScanNow, onAddEvent }: Props) {
  const [scanning, setScanning] = useState(false);

  async function promptForKey() {
    const next = prompt("Admin key:");
    if (next) onSetKey(next);
  }

  async function handleScan() {
    if (!adminKey) {
      promptForKey();
      return;
    }
    setScanning(true);
    try {
      await onScanNow();
    } finally {
      setScanning(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button onClick={() => (adminKey ? onAddEvent() : promptForKey())} style={btnPrimary}>
        + Add event
      </button>
      <button onClick={handleScan} disabled={scanning} style={btnSecondary}>
        {scanning ? "Scanning…" : "🔍 Scan now"}
      </button>
      {adminKey ? (
        <button onClick={() => onSetKey(null)} style={btnGhost}>
          Clear admin key
        </button>
      ) : (
        <button onClick={promptForKey} style={btnGhost}>
          Enter admin key
        </button>
      )}
    </div>
  );
}

const btnBase: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  padding: "7px 14px",
  textTransform: "uppercase",
  letterSpacing: 1,
  borderRadius: "var(--r-sm)",
  border: "1.5px solid var(--green)",
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "var(--green)",
  color: "var(--cream)",
};

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  background: "#fff",
  color: "var(--text)",
};

const btnGhost: React.CSSProperties = {
  ...btnBase,
  background: "transparent",
  border: "1.5px solid transparent",
  color: "var(--text-muted)",
  textDecoration: "underline",
};
