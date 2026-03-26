// Server-side in-memory store for monitor API
// Client pushes snapshots via POST /api/monitor, external readers use GET /api/monitor

export interface MonitorSnapshot {
  tick: number;
  running: boolean;
  speed: number;
  population: {
    total: number;
    farmer: number;
    builder: number;
    energist: number;
    generalist: number;
  };
  economy: {
    gini_coefficient: number;
    avg_health: number;
    total_trades_executed: number;
    total_trades_rejected: number;
    total_births: number;
    total_deaths: number;
    total_hires: number;
    total_contract_breaks: number;
    active_contracts: number;
    largest_dynasty: { founder: string; members: number } | null;
  };
  recent_events: string[];
  top_agents: {
    id: string;
    type: string;
    net_worth: number;
    health: number;
    employees: number;
    children: number;
  }[];
  bottom_agents: {
    id: string;
    type: string;
    net_worth: number;
    health: number;
    ticks_starving: number;
  }[];
  experiment: string;
  updated_at: number;
}

// Global variable survives across requests in the same process
const globalStore = globalThis as unknown as { __monitorSnapshot?: MonitorSnapshot };

export function getSnapshot(): MonitorSnapshot | null {
  return globalStore.__monitorSnapshot ?? null;
}

export function setSnapshot(snapshot: MonitorSnapshot): void {
  globalStore.__monitorSnapshot = snapshot;
}
