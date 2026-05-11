import type { EventDb } from "@/lib/types";

type Props = {
  events: EventDb[];
  unconfirmedCount: number;
  lastScoutAt: string | null;
};

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatLong(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function shortMD(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TodayBanner({ events, unconfirmedCount, lastScoutAt }: Props) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const todays = events.filter((e) => {
    const start = parseDate(e.start_date);
    const end = e.end_date ? parseDate(e.end_date) : start;
    return now >= start && now <= end;
  });

  const upcoming = events
    .filter((e) => parseDate(e.start_date) > now)
    .sort((a, b) => parseDate(a.start_date).getTime() - parseDate(b.start_date).getTime());

  let primary: string;
  if (todays.length) {
    primary = `Happening today: ${todays.map((e) => e.name).join(" · ")}`;
  } else if (upcoming.length) {
    const next = upcoming[0];
    const days = Math.ceil((parseDate(next.start_date).getTime() - now.getTime()) / 86_400_000);
    primary = `Next up: ${next.name} — in ${days} day${days === 1 ? "" : "s"} (${shortMD(parseDate(next.start_date))})`;
  } else {
    primary = "No upcoming events. Run the scout or add one manually.";
  }

  const scoutLine =
    unconfirmedCount > 0
      ? `🔍 ${unconfirmedCount} new event${unconfirmedCount === 1 ? "" : "s"} to review`
      : lastScoutAt
        ? `Last scout: ${shortMD(new Date(lastScoutAt))}, 0 new`
        : null;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, var(--orange) 0%, #a14a0c 100%)",
        color: "#fff",
        padding: "12px 18px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--green)",
        boxShadow: "var(--shadow-card)",
        marginBottom: 20,
      }}
    >
      <div className="mono" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
        Today — {formatLong(now)}
      </div>
      <div style={{ fontSize: 13, marginTop: 4 }}>{primary}</div>
      {scoutLine && <div style={{ fontSize: 11, marginTop: 4, opacity: 0.95 }}>{scoutLine}</div>}
    </div>
  );
}
