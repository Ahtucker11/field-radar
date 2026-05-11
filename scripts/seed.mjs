import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const SEED = [
  { name: "B2B Online Chicago", label: "B2B Online CHI", start_date: "2026-05-04", end_date: "2026-05-06", tier: "tier-2", location: "loc-chi", notes: "Enterprise B2B / SMB-adjacent buyer audience." },
  { name: "AI + Robotics Summit @ 1819", label: "AI+Robotics 1819", start_date: "2026-05-14", end_date: "2026-05-14", tier: "tier-1", location: "loc-cin", notes: "eGateway Capital + 1819. Marvin's house. Relationship play. CONFLICT: same day as Ohio Tech Summit." },
  { name: "Ohio Tech Summit", label: "Ohio Tech Summit", start_date: "2026-05-14", end_date: "2026-05-14", tier: "tier-1", location: "loc-cmh", notes: "Ohio Union, OSU. 3 tracks: Enterprise, Startups, Talent. Conflicts with 1819. Net-new Columbus buyers.", url: "https://www.ohiotechsummit.org" },
  { name: "Cincy AI Week hotel block deadline", label: "Cincy AI hotel block", start_date: "2026-05-18", end_date: "2026-05-18", tier: "tier-3", location: "loc-rec", notes: "Book by this date for group rate." },
  { name: "Submit Scrappy Hat event for TCW", label: "Submit TCW event", start_date: "2026-05-25", end_date: "2026-05-25", tier: "tier-3", location: "loc-rec", notes: "Visibility on TCW LinkedIn (~7.5K followers).", url: "https://gotechchicago.com/week/" },
  { name: "Data Council — Gleacher Center", label: "Data Council CHI", start_date: "2026-05-28", end_date: "2026-05-29", tier: "tier-2", location: "loc-chi", notes: "Practitioner-heavy. Anti-pitch tone fits Scrappy Hat voice." },
  { name: "Cincy AI Week — Union Hall, OTR", label: "Cincy AI Week", start_date: "2026-06-09", end_date: "2026-06-13", tier: "tier-1", location: "loc-cin", notes: "Conf Jun 9-11, community Jun 9-13. Claude track + hackathon. Cintrifuse Demo Day.", url: "https://www.cincyaiweek.com" },
  { name: "AI Tinkerers Cincinnati (during Cincy AI Wk)", label: "AI Tinkerers CIN", start_date: "2026-06-12", end_date: "2026-06-12", tier: "tier-2", location: "loc-cin", notes: "Builder-only. Live code demos.", url: "https://cincinnati.aitinkerers.org" },
  { name: "TechChicago Week calendar goes live", label: "TCW cal live", start_date: "2026-06-15", end_date: "2026-06-15", tier: "tier-3", location: "loc-rec", notes: "Pick events: 1871 immersion, Drive Capital dinner, Chicago:Blend kickoff.", url: "https://gotechchicago.com/week/" },
  { name: "Chicago AI Week", label: "Chicago AI Week", start_date: "2026-06-25", end_date: "2026-06-26", tier: "tier-1", location: "loc-chi", notes: "Applied AI, 1000+ attendees." },
  { name: "AI Tinkerers Cincinnati (monthly)", label: "AI Tinkerers (est)", start_date: "2026-07-10", end_date: "2026-07-10", tier: "tier-2", location: "loc-rec", notes: "Estimated date. Confirm when calendar updates.", url: "https://cincinnati.aitinkerers.org" },
  { name: "Indiana CIO Network — E-gineering", label: "Indiana CIO Network", start_date: "2026-07-14", end_date: "2026-07-14", tier: "tier-2", location: "loc-ind", notes: "Senior tech leader dinner. No-sales forum. Requires membership.", url: "https://techpoint.org/indiana-cio-network/events/" },
  { name: "TechChicago Week", label: "TechChicago Week", start_date: "2026-07-21", end_date: "2026-07-27", tier: "tier-1", location: "loc-chi", notes: "100+ events curated by P33. Highest-leverage week of the year.", url: "https://gotechchicago.com/week/" },
];

async function main() {
  const { data: existing } = await supabase.from("events").select("name, start_date");
  const existingKeys = new Set((existing ?? []).map((e) => `${e.name}::${e.start_date}`));

  let inserted = 0;
  for (const ev of SEED) {
    if (existingKeys.has(`${ev.name}::${ev.start_date}`)) {
      console.log(`skip (exists): ${ev.name}`);
      continue;
    }
    const { error } = await supabase.from("events").insert({ ...ev, source: "manual", confirmed: true });
    if (error) {
      console.error(`error inserting ${ev.name}:`, error.message);
    } else {
      inserted++;
      console.log(`inserted: ${ev.name}`);
    }
  }
  console.log(`\ndone. ${inserted}/${SEED.length} inserted.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
