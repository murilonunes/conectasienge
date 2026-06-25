import "server-only";
import { existsSync, mkdirSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";

export type AppSettings = {
  responsibleName: string;
  responsibleRole: string;
  responsibleInitials: string;
  dashboardDays: number;
  siengeStartDate: string;
  siengeEndDate: string;
  payablesFutureMonths: number;
  reconciliationAccountNumbers: string;
  inventoryCostCenterIds: string;
  showUpdateWarnings: boolean;
};

export type SiengeIntegrationRange = {
  startDate: string;
  endDate: string;
};

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultSiengeEndDate() {
  const today = new Date();
  return iso(new Date(today.getFullYear() + 2, 11, 31, 12));
}

function defaults(): AppSettings {
  return {
    responsibleName: "Marina Costa",
    responsibleRole: "Administradora",
    responsibleInitials: "MC",
    dashboardDays: 7,
    siengeStartDate: "2000-01-01",
    siengeEndDate: defaultSiengeEndDate(),
    payablesFutureMonths: 2,
    reconciliationAccountNumbers: "",
    inventoryCostCenterIds: "",
    showUpdateWarnings: true
  };
}

const dataDir = path.join(process.cwd(), ".sienge-data");
const databasePath = path.join(dataDir, "app-settings.sqlite");
let connection: DatabaseSync | undefined;

function getDatabase() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (connection) return connection;
  connection = new DatabaseSync(databasePath);
  connection.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return connection;
}

function readSettingsMap() {
  const rows = getDatabase()
    .prepare("SELECT key, value FROM app_settings")
    .all() as Array<{ key: string; value: string }>;
  return new Map(rows.map((row) => [row.key, row.value]));
}

function toNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function initialsFromName(name: string) {
  const fallback = defaults().responsibleInitials;
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || fallback;
}

function dashboardDaysFromSettings(values: Map<string, string>) {
  const currentDefaults = defaults();
  const storedDays = values.get("dashboardDays");
  if (storedDays) return toNumber(storedDays, currentDefaults.dashboardDays, 7, 1825);

  const storedMonths = values.get("dashboardMonths");
  if (storedMonths) {
    return currentDefaults.dashboardDays;
  }

  return currentDefaults.dashboardDays;
}

function toDateText(value: string | undefined, fallback: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value! : fallback;
}

function integrationRangeFromSettings(values: Map<string, string>): SiengeIntegrationRange {
  const currentDefaults = defaults();
  let startDate = toDateText(values.get("siengeStartDate"), currentDefaults.siengeStartDate);
  let endDate = toDateText(values.get("siengeEndDate"), currentDefaults.siengeEndDate);
  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }
  return { startDate, endDate };
}

export function getAppSettings(): AppSettings {
  const currentDefaults = defaults();
  const values = readSettingsMap();
  const responsibleName = values.get("responsibleName") || currentDefaults.responsibleName;
  const responsibleInitials = values.get("responsibleInitials") || initialsFromName(responsibleName);
  const integrationRange = integrationRangeFromSettings(values);

  return {
    responsibleName,
    responsibleRole: values.get("responsibleRole") || currentDefaults.responsibleRole,
    responsibleInitials: responsibleInitials.slice(0, 3).toUpperCase(),
    dashboardDays: dashboardDaysFromSettings(values),
    siengeStartDate: integrationRange.startDate,
    siengeEndDate: integrationRange.endDate,
    payablesFutureMonths: toNumber(values.get("payablesFutureMonths"), currentDefaults.payablesFutureMonths, 1, 6),
    reconciliationAccountNumbers: values.get("reconciliationAccountNumbers") || values.get("reconciliationAccountNumber") || currentDefaults.reconciliationAccountNumbers,
    inventoryCostCenterIds: values.get("inventoryCostCenterIds") || currentDefaults.inventoryCostCenterIds,
    showUpdateWarnings: values.get("showUpdateWarnings") !== "false"
  };
}

export function getSiengeIntegrationRange(): SiengeIntegrationRange {
  const settings = getAppSettings();
  return {
    startDate: settings.siengeStartDate,
    endDate: settings.siengeEndDate
  };
}

export function saveAppSettings(settings: Partial<AppSettings>) {
  const current = getAppSettings();
  const next: AppSettings = {
    ...current,
    ...settings
  };
  if (!next.responsibleInitials.trim()) {
    next.responsibleInitials = initialsFromName(next.responsibleName);
  }

  const database = getDatabase();
  const statement = database.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);
  const now = new Date().toISOString();
  database.exec("BEGIN");
  try {
    Object.entries(next).forEach(([key, value]) => {
      statement.run(key, String(value), now);
    });
    statement.run("dashboardShortDefaultApplied", "true", now);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
