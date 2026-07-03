import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";

export type SupplierQuoteTokenPayload = {
  quotationId: number;
  supplierId?: number;
  document?: string;
  exp: number;
  iat: number;
  nonce: string;
};

export type SupplierQuoteResponseInput = {
  token: string;
  supplierName: string;
  document: string;
  email?: string;
  phone?: string;
  registration?: Record<string, unknown>;
  items: Array<{
    itemNumber: number;
    attends: boolean;
    unitPrice?: number;
    quantity?: number;
    deadlineDays?: number;
    notes?: string;
  }>;
};

export type SupplierQuoteResponseItem = SupplierQuoteResponseInput["items"][number];

export type SupplierQuoteResponseSummary = {
  id: number;
  quotationId: number;
  supplierId?: number;
  supplierName: string;
  document: string;
  email?: string;
  phone?: string;
  registration?: Record<string, unknown>;
  registrationPending: boolean;
  items: SupplierQuoteResponseItem[];
  attendedCount: number;
  totalValue: number;
  createdAt: string;
};

export type SupplierQuoteAwardScope = "quotation" | "item";

export type SupplierQuoteAwardInput = {
  quotationId: number;
  scope: SupplierQuoteAwardScope;
  itemNumber?: number;
  responseId: number;
  supplierName: string;
  document: string;
  justification: string;
};

export type SupplierQuoteAwardSummary = SupplierQuoteAwardInput & {
  id: number;
  createdAt: string;
};

export type SupplierRegistrationReviewStatus = "pending" | "prepared" | "created" | "failed";

export type SupplierRegistrationReview = {
  document: string;
  status: SupplierRegistrationReviewStatus;
  result?: Record<string, unknown>;
  reviewedAt: string;
};

export type SupplierQuoteInvitationSummary = {
  id: number;
  quotationId: number;
  supplierId?: number;
  supplierName?: string;
  document?: string;
  token: string;
  url: string;
  expiresAt: string;
  createdAt: string;
  responseCount: number;
  lastResponseAt?: string;
  status: "answered" | "pending" | "expired";
};

export type SupplierQuoteEventType =
  | "link_sent"
  | "response_received"
  | "supplier_approved"
  | "integration_error"
  | "sienge_created";

export type SupplierQuoteEventInput = {
  quotationId: number;
  type: SupplierQuoteEventType;
  title: string;
  description?: string;
  supplierName?: string;
  document?: string;
  metadata?: Record<string, unknown>;
};

export type SupplierQuoteEventSummary = SupplierQuoteEventInput & {
  id: number;
  createdAt: string;
};

const dataDir = path.join(process.cwd(), ".sienge-data");
const databasePath = path.join(dataDir, "supplier-quotations.sqlite");
const localSecretPath = path.join(dataDir, "supplier-portal-secret");

function secret() {
  const value = process.env.SUPPLIER_PORTAL_SECRET;
  if (value && value.length >= 32) {
    return value;
  }

  mkdirSync(dataDir, { recursive: true });
  if (existsSync(localSecretPath)) {
    const localValue = readFileSync(localSecretPath, "utf8").trim();
    if (localValue.length >= 32) return localValue;
  }

  const localValue = randomBytes(48).toString("base64url");
  writeFileSync(localSecretPath, `${localValue}\n`, { encoding: "utf8", mode: 0o600 });
  return localValue;
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function database() {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_quote_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL,
      quotation_id INTEGER NOT NULL,
      supplier_id INTEGER,
      supplier_name TEXT NOT NULL,
      document TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      registration_json TEXT,
      items_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_supplier_quote_responses_quotation ON supplier_quote_responses(quotation_id);
    CREATE INDEX IF NOT EXISTS idx_supplier_quote_responses_document ON supplier_quote_responses(document);
    CREATE INDEX IF NOT EXISTS idx_supplier_quote_responses_token ON supplier_quote_responses(token_hash);

    CREATE TABLE IF NOT EXISTS supplier_quote_awards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      scope TEXT NOT NULL,
      item_number INTEGER,
      response_id INTEGER NOT NULL,
      supplier_name TEXT NOT NULL,
      document TEXT NOT NULL,
      justification TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_supplier_quote_awards_quotation ON supplier_quote_awards(quotation_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_quote_awards_unique_scope ON supplier_quote_awards(quotation_id, scope, COALESCE(item_number, 0));

    CREATE TABLE IF NOT EXISTS supplier_registration_reviews (
      document TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      result_json TEXT,
      reviewed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supplier_quote_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      supplier_id INTEGER,
      supplier_name TEXT,
      document TEXT,
      token_hash TEXT NOT NULL,
      token TEXT NOT NULL,
      url TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_supplier_quote_invitations_quotation ON supplier_quote_invitations(quotation_id);
    CREATE INDEX IF NOT EXISTS idx_supplier_quote_invitations_token ON supplier_quote_invitations(token_hash);

    CREATE TABLE IF NOT EXISTS supplier_quote_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      supplier_name TEXT,
      document TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_supplier_quote_events_quotation ON supplier_quote_events(quotation_id);
  `);
  return db;
}

export function recordSupplierQuoteEvent(input: SupplierQuoteEventInput) {
  const db = database();
  try {
    return insertSupplierQuoteEvent(db, input);
  } finally {
    db.close();
  }
}

function insertSupplierQuoteEvent(db: DatabaseSync, input: SupplierQuoteEventInput) {
  const createdAt = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO supplier_quote_events (
      quotation_id, type, title, description, supplier_name, document, metadata_json, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.quotationId,
    input.type,
    input.title,
    input.description?.trim() || null,
    input.supplierName?.trim() || null,
    input.document?.replace(/\D/g, "") || null,
    input.metadata ? JSON.stringify(input.metadata) : null,
    createdAt
  );

  return {
    id: Number(result.lastInsertRowid),
    ...input,
    document: input.document?.replace(/\D/g, "") || undefined,
    createdAt
  } satisfies SupplierQuoteEventSummary;
}

export function createSupplierQuoteToken(input: { quotationId: number; supplierId?: number; document?: string; expiresInDays?: number }) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SupplierQuoteTokenPayload = {
    quotationId: input.quotationId,
    supplierId: input.supplierId,
    document: input.document?.replace(/\D/g, "") || undefined,
    iat: now,
    exp: now + (input.expiresInDays || 7) * 24 * 60 * 60,
    nonce: randomBytes(12).toString("hex")
  };
  const encodedPayload = base64url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function saveSupplierQuoteInvitation(input: {
  token: string;
  url: string;
  quotationId: number;
  supplierId?: number;
  supplierName?: string;
  document?: string;
  expiresAt: string;
}) {
  const db = database();
  try {
    const createdAt = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO supplier_quote_invitations (
        quotation_id, supplier_id, supplier_name, document, token_hash, token, url, expires_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.quotationId,
      input.supplierId ?? null,
      input.supplierName?.trim() || null,
      input.document?.replace(/\D/g, "") || null,
      hashToken(input.token),
      input.token,
      input.url,
      input.expiresAt,
      createdAt
    );

    const invitation = {
      id: Number(result.lastInsertRowid),
      quotationId: input.quotationId,
      supplierId: input.supplierId,
      supplierName: input.supplierName,
      document: input.document?.replace(/\D/g, "") || undefined,
      token: input.token,
      url: input.url,
      expiresAt: input.expiresAt,
      createdAt,
      responseCount: 0,
      status: new Date(input.expiresAt).getTime() < Date.now() ? "expired" : "pending"
    } satisfies SupplierQuoteInvitationSummary;
    insertSupplierQuoteEvent(db, {
      quotationId: input.quotationId,
      type: "link_sent",
      title: "Link enviado ao fornecedor",
      description: `Validade até ${input.expiresAt}.`,
      supplierName: input.supplierName,
      document: input.document,
      metadata: { invitationId: invitation.id, supplierId: input.supplierId, url: input.url }
    });
    return invitation;
  } finally {
    db.close();
  }
}

export function verifySupplierQuoteToken(token: string): SupplierQuoteTokenPayload | undefined {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return undefined;
  if (!safeCompare(sign(encodedPayload), signature)) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SupplierQuoteTokenPayload;
    if (!payload.quotationId || payload.exp < Math.floor(Date.now() / 1000)) return undefined;
    return payload;
  } catch {
    return undefined;
  }
}

export function saveSupplierQuoteResponse(input: SupplierQuoteResponseInput, payload: SupplierQuoteTokenPayload) {
  const db = database();
  try {
    const createdAt = new Date().toISOString();
    const document = input.document.replace(/\D/g, "");
    const result = db.prepare(`
      INSERT INTO supplier_quote_responses (
        token_hash, quotation_id, supplier_id, supplier_name, document, email, phone,
        registration_json, items_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      hashToken(input.token),
      payload.quotationId,
      payload.supplierId ?? null,
      input.supplierName.trim(),
      document,
      input.email?.trim() || null,
      input.phone?.trim() || null,
      input.registration ? JSON.stringify(input.registration) : null,
      JSON.stringify(input.items),
      createdAt
    );
    insertSupplierQuoteEvent(db, {
      quotationId: payload.quotationId,
      type: "response_received",
      title: "Resposta recebida do fornecedor",
      description: `${input.items.filter((item) => item.attends).length} item(ns) atendido(s).`,
      supplierName: input.supplierName,
      document,
      metadata: { responseId: Number(result.lastInsertRowid), supplierId: payload.supplierId }
    });
    return { id: Number(result.lastInsertRowid), createdAt };
  } finally {
    db.close();
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function loadSupplierQuoteResponses(quotationId: number): SupplierQuoteResponseSummary[] {
  if (!supplierQuoteDatabaseExists()) return [];

  const db = database();
  try {
    const rows = db.prepare(`
      SELECT
        id,
        quotation_id,
        supplier_id,
        supplier_name,
        document,
        email,
        phone,
        registration_json,
        items_json,
        created_at
      FROM supplier_quote_responses
      WHERE quotation_id = ?
      ORDER BY datetime(created_at) DESC, id DESC
    `).all(quotationId) as Array<{
      id: number;
      quotation_id: number;
      supplier_id: number | null;
      supplier_name: string;
      document: string;
      email: string | null;
      phone: string | null;
      registration_json: string | null;
      items_json: string;
      created_at: string;
    }>;

    return rows.map((row) => {
      const items = parseJson<SupplierQuoteResponseItem[]>(row.items_json, []);
      const attendedItems = items.filter((item) => item.attends);
      return {
        id: row.id,
        quotationId: row.quotation_id,
        supplierId: row.supplier_id ?? undefined,
        supplierName: row.supplier_name,
        document: row.document,
        email: row.email ?? undefined,
        phone: row.phone ?? undefined,
        registration: parseJson<Record<string, unknown> | undefined>(row.registration_json, undefined),
        registrationPending: Boolean(row.registration_json),
        items,
        attendedCount: attendedItems.length,
        totalValue: attendedItems.reduce((sum, item) => sum + ((item.unitPrice || 0) * (item.quantity || 0)), 0),
        createdAt: row.created_at
      };
    });
  } finally {
    db.close();
  }
}

export function loadSupplierQuoteInvitations(quotationId: number): SupplierQuoteInvitationSummary[] {
  if (!supplierQuoteDatabaseExists()) return [];

  const db = database();
  try {
    const rows = db.prepare(`
      SELECT
        invitation.id,
        invitation.quotation_id,
        invitation.supplier_id,
        invitation.supplier_name,
        invitation.document,
        invitation.token,
        invitation.url,
        invitation.expires_at,
        invitation.created_at,
        COUNT(response.id) AS response_count,
        MAX(response.created_at) AS last_response_at
      FROM supplier_quote_invitations invitation
      LEFT JOIN supplier_quote_responses response ON response.token_hash = invitation.token_hash
      WHERE invitation.quotation_id = ?
      GROUP BY
        invitation.id,
        invitation.quotation_id,
        invitation.supplier_id,
        invitation.supplier_name,
        invitation.document,
        invitation.token,
        invitation.url,
        invitation.expires_at,
        invitation.created_at
      ORDER BY datetime(invitation.created_at) DESC, invitation.id DESC
    `).all(quotationId) as Array<{
      id: number;
      quotation_id: number;
      supplier_id: number | null;
      supplier_name: string | null;
      document: string | null;
      token: string;
      url: string;
      expires_at: string;
      created_at: string;
      response_count: number;
      last_response_at: string | null;
    }>;

    return rows.map((row) => {
      const responseCount = Number(row.response_count || 0);
      const expired = new Date(row.expires_at).getTime() < Date.now();
      return {
        id: row.id,
        quotationId: row.quotation_id,
        supplierId: row.supplier_id ?? undefined,
        supplierName: row.supplier_name ?? undefined,
        document: row.document ?? undefined,
        token: row.token,
        url: row.url,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        responseCount,
        lastResponseAt: row.last_response_at ?? undefined,
        status: responseCount > 0 ? "answered" : expired ? "expired" : "pending"
      };
    });
  } finally {
    db.close();
  }
}

export function saveSupplierQuoteAwards(quotationId: number, scope: SupplierQuoteAwardScope, awards: SupplierQuoteAwardInput[]) {
  const db = database();
  try {
    const createdAt = new Date().toISOString();
    const validAwards = awards.filter((award) =>
      award.quotationId === quotationId
      && award.scope === scope
      && award.responseId > 0
      && award.supplierName.trim()
      && award.document.trim()
      && award.justification.trim()
    );

    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM supplier_quote_awards WHERE quotation_id = ? AND scope = ?").run(quotationId, scope);
      const statement = db.prepare(`
        INSERT INTO supplier_quote_awards (
          quotation_id, scope, item_number, response_id, supplier_name, document, justification, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      validAwards.forEach((award) => {
        statement.run(
          quotationId,
          scope,
          scope === "item" ? award.itemNumber ?? null : null,
          award.responseId,
          award.supplierName.trim(),
          award.document.replace(/\D/g, ""),
          award.justification.trim(),
          createdAt
        );
        insertSupplierQuoteEvent(db, {
          quotationId,
          type: "supplier_approved",
          title: scope === "item" ? "Fornecedor aprovado por item" : "Fornecedor aprovado para a cotação",
          description: award.justification,
          supplierName: award.supplierName,
          document: award.document,
          metadata: { scope, itemNumber: award.itemNumber, responseId: award.responseId }
        });
      });
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    return loadSupplierQuoteAwards(quotationId);
  } finally {
    db.close();
  }
}

export function loadSupplierQuoteAwards(quotationId: number): SupplierQuoteAwardSummary[] {
  if (!supplierQuoteDatabaseExists()) return [];

  const db = database();
  try {
    const rows = db.prepare(`
      SELECT
        id,
        quotation_id,
        scope,
        item_number,
        response_id,
        supplier_name,
        document,
        justification,
        created_at
      FROM supplier_quote_awards
      WHERE quotation_id = ?
      ORDER BY scope, item_number, datetime(created_at) DESC, id DESC
    `).all(quotationId) as Array<{
      id: number;
      quotation_id: number;
      scope: SupplierQuoteAwardScope;
      item_number: number | null;
      response_id: number;
      supplier_name: string;
      document: string;
      justification: string;
      created_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      quotationId: row.quotation_id,
      scope: row.scope,
      itemNumber: row.item_number ?? undefined,
      responseId: row.response_id,
      supplierName: row.supplier_name,
      document: row.document,
      justification: row.justification,
      createdAt: row.created_at
    }));
  } finally {
    db.close();
  }
}

export function saveSupplierRegistrationReview(input: { document: string; status: SupplierRegistrationReviewStatus; result?: Record<string, unknown> }) {
  const document = input.document.replace(/\D/g, "");
  if (!document) throw new Error("Documento do fornecedor não informado.");

  const db = database();
  try {
    const reviewedAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO supplier_registration_reviews (document, status, result_json, reviewed_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(document) DO UPDATE SET
        status = excluded.status,
        result_json = excluded.result_json,
        reviewed_at = excluded.reviewed_at
    `).run(
      document,
      input.status,
      input.result ? JSON.stringify(input.result) : null,
      reviewedAt
    );

    return { document, status: input.status, result: input.result, reviewedAt } satisfies SupplierRegistrationReview;
  } finally {
    db.close();
  }
}

export function loadSupplierRegistrationReviews(documents: string[]): Record<string, SupplierRegistrationReview> {
  const cleanDocuments = Array.from(new Set(documents.map((document) => document.replace(/\D/g, "")).filter(Boolean)));
  if (!cleanDocuments.length || !supplierQuoteDatabaseExists()) return {};

  const db = database();
  try {
    const placeholders = cleanDocuments.map(() => "?").join(", ");
    const rows = db.prepare(`
      SELECT document, status, result_json, reviewed_at
      FROM supplier_registration_reviews
      WHERE document IN (${placeholders})
    `).all(...cleanDocuments) as Array<{
      document: string;
      status: SupplierRegistrationReviewStatus;
      result_json: string | null;
      reviewed_at: string;
    }>;

    return Object.fromEntries(rows.map((row) => [
      row.document,
      {
        document: row.document,
        status: row.status,
        result: parseJson<Record<string, unknown> | undefined>(row.result_json, undefined),
        reviewedAt: row.reviewed_at
      }
    ]));
  } finally {
    db.close();
  }
}

export function loadSupplierQuoteEvents(quotationId: number): SupplierQuoteEventSummary[] {
  if (!supplierQuoteDatabaseExists()) return [];

  const db = database();
  try {
    const rows = db.prepare(`
      SELECT
        id,
        quotation_id,
        type,
        title,
        description,
        supplier_name,
        document,
        metadata_json,
        created_at
      FROM supplier_quote_events
      WHERE quotation_id = ?
      ORDER BY datetime(created_at) DESC, id DESC
    `).all(quotationId) as Array<{
      id: number;
      quotation_id: number;
      type: SupplierQuoteEventType;
      title: string;
      description: string | null;
      supplier_name: string | null;
      document: string | null;
      metadata_json: string | null;
      created_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      quotationId: row.quotation_id,
      type: row.type,
      title: row.title,
      description: row.description ?? undefined,
      supplierName: row.supplier_name ?? undefined,
      document: row.document ?? undefined,
      metadata: parseJson<Record<string, unknown> | undefined>(row.metadata_json, undefined),
      createdAt: row.created_at
    }));
  } finally {
    db.close();
  }
}

export function supplierQuoteDatabaseExists() {
  return existsSync(databasePath);
}
