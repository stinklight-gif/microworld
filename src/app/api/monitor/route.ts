import { NextRequest, NextResponse } from "next/server";
import { getSnapshot, setSnapshot, MonitorSnapshot } from "@/lib/monitor-store";

export const dynamic = "force-dynamic";

const MONITOR_API_KEY = process.env.MONITOR_API_KEY || "";

// GET /api/monitor?key=<MONITOR_API_KEY> — read-only for Samantha
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");

  if (!MONITOR_API_KEY || key !== MONITOR_API_KEY) {
    return NextResponse.json({ error: "Unauthorized. Provide valid ?key= parameter." }, { status: 401 });
  }

  const snapshot = getSnapshot();
  if (!snapshot) {
    return NextResponse.json({ error: "No simulation data yet. Start the simulation first." }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}

// POST /api/monitor — client pushes state snapshots (no auth needed, internal only)
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MonitorSnapshot;
    setSnapshot(body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid snapshot data" }, { status: 400 });
  }
}
