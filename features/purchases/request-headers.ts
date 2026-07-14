import "server-only";
import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";

// Situação da solicitação de compra no Sienge. O espelho em lista
// (/v1/purchase-requests/all/items) não traz esse dado: só o endpoint
// individual /v1/purchase-requests/{id} informa se a solicitação já foi
// atendida. A sincronização abaixo é incremental: busca uma vez cada
// solicitação e depois só volta nas que ainda não chegaram em status final.

export type PurchaseRequestHeader = {
  id: number;
  status: string;
  requestDate?: string;
  requesterUser?: string;
  buildingId?: number;
  notes?: string;
  draft?: boolean;
  savedAt: string;
};

const databasePath = path.join(process.cwd(), ".sienge-data", "purchases.sqlite");

// Status que não mudam mais: não precisam ser consultados de novo.
const finalStatuses = new Set(["FULLY_ATTENDED", "CANCELED", "DISAPPROVED"]);

export const requestStatusLabels: Record<string, string> = {
  PENDING: "Pendente",
  PARTIALLY_ATTENDED: "Parcialmente atendida",
  FULLY_ATTENDED: "Atendida",
  CANCELED: "Cancelada",
  DISAPPROVED: "Reprovada"
};

export function requestHeaderIsOpen(header: PurchaseRequestHeader) {
  return !finalStatuses.has(header.status) && header.draft !== true;
}

function openDatabase() {
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS purchase_request_headers (
      id INTEGER PRIMARY KEY,
      status TEXT NOT NULL,
      request_date TEXT,
      requester_user TEXT,
      building_id INTEGER,
      notes TEXT,
      draft INTEGER,
      saved_at TEXT NOT NULL
    );
  `);
  return database;
}

export function readPurchaseRequestHeaders(): Map<number, PurchaseRequestHeader> {
  const headers = new Map<number, PurchaseRequestHeader>();
  if (!existsSync(databasePath)) return headers;
  const database = openDatabase();
  try {
    const rows = database.prepare("SELECT * FROM purchase_request_headers").all() as Array<{
      id: number;
      status: string;
      request_date: string | null;
      requester_user: string | null;
      building_id: number | null;
      notes: string | null;
      draft: number | null;
      saved_at: string;
    }>;
    rows.forEach((row) => {
      headers.set(row.id, {
        id: row.id,
        status: row.status,
        requestDate: row.request_date || undefined,
        requesterUser: row.requester_user || undefined,
        buildingId: row.building_id || undefined,
        notes: row.notes || undefined,
        draft: row.draft === 1 ? true : undefined,
        savedAt: row.saved_at
      });
    });
    return headers;
  } finally {
    database.close();
  }
}

function siengeConfig() {
  const tenant = process.env.SIENGE_TENANT;
  const username = process.env.SIENGE_USERNAME;
  const password = process.env.SIENGE_PASSWORD;
  if (!tenant || !username || !password) return undefined;
  return { tenant, username, password };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHeader(config: { tenant: string; username: string; password: string }, id: number) {
  const url = `https://api.sienge.com.br/${config.tenant}/public/api/v1/purchase-requests/${id}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}` },
      cache: "no-store"
    });
    if (response.status === 429 || response.status >= 500) {
      await sleep((attempt + 1) * 800);
      continue;
    }
    if (!response.ok) return undefined;
    return await response.json() as {
      id: number;
      status?: string;
      requestDate?: string;
      requesterUser?: string;
      buildingId?: number;
      notes?: string;
      draft?: boolean;
    };
  }
  return undefined;
}

export type RequestHeaderSyncResult = {
  checked: number;
  updated: number;
  failed: number;
  skippedFinal: number;
};

// Sincroniza os cabeçalhos das solicitações informadas (normalmente os IDs do
// espelho de itens). Só consulta o Sienge para solicitações novas ou ainda em
// aberto; as já finalizadas ficam como estão.
export async function syncPurchaseRequestHeaders(ids: number[]): Promise<RequestHeaderSyncResult> {
  const config = siengeConfig();
  const result: RequestHeaderSyncResult = { checked: 0, updated: 0, failed: 0, skippedFinal: 0 };
  if (!config || !ids.length) return result;

  const known = readPurchaseRequestHeaders();
  const pendingIds = Array.from(new Set(ids)).filter((id) => {
    const header = known.get(id);
    if (header && finalStatuses.has(header.status)) {
      result.skippedFinal += 1;
      return false;
    }
    return Number.isFinite(id) && id > 0;
  });
  if (!pendingIds.length) return result;

  const database = openDatabase();
  try {
    const upsert = database.prepare(`
      INSERT INTO purchase_request_headers (id, status, request_date, requester_user, building_id, notes, draft, saved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        request_date = excluded.request_date,
        requester_user = excluded.requester_user,
        building_id = excluded.building_id,
        notes = excluded.notes,
        draft = excluded.draft,
        saved_at = excluded.saved_at
    `);

    for (const id of pendingIds) {
      result.checked += 1;
      if (result.checked > 1) await sleep(300);
      const header = await fetchHeader(config, id);
      if (!header || !header.status) {
        result.failed += 1;
        continue;
      }
      upsert.run(
        id,
        header.status,
        header.requestDate || null,
        header.requesterUser || null,
        Number(header.buildingId) || null,
        header.notes || null,
        header.draft === true ? 1 : 0,
        new Date().toISOString()
      );
      result.updated += 1;
    }
  } finally {
    database.close();
  }
  return result;
}
