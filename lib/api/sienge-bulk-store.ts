import "server-only";
import type { DatabaseSync } from "node:sqlite";

type JsonRecord = Record<string, unknown>;
type ProgressHandler = (progress: { stage: string; message: string; detail?: string; current?: number; total?: number }) => void;

export type SiengeStoreContext = {
  tenant: string;
  endpoint: string;
  queryJson: string;
  day: string;
  savedAt: string;
};

function value(item: JsonRecord, key: string) {
  const current = item[key];
  if (current === undefined || current === null) return null;
  if (typeof current === "object") return JSON.stringify(current);
  return current as string | number | boolean;
}

function runInsert(database: DatabaseSync, table: string, columns: string[], values: unknown[]) {
  const placeholders = columns.map(() => "?").join(", ");
  database.prepare(`
    INSERT OR REPLACE INTO ${table} (${columns.join(", ")})
    VALUES (${placeholders})
  `).run(...values);
}

function createOutcomeTables(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS bulk_outcome_installments (
      tenant TEXT NOT NULL,
      billId INTEGER NOT NULL,
      installmentId INTEGER NOT NULL,
      companyId INTEGER,
      companyName TEXT,
      businessAreaId INTEGER,
      businessAreaName TEXT,
      projectId INTEGER,
      projectName TEXT,
      groupCompanyId INTEGER,
      groupCompanyName TEXT,
      holdingId INTEGER,
      holdingName TEXT,
      subsidiaryId INTEGER,
      subsidiaryName TEXT,
      businessTypeId INTEGER,
      businessTypeName TEXT,
      creditorId INTEGER,
      creditorName TEXT,
      documentIdentificationId TEXT,
      documentIdentificationName TEXT,
      documentNumber TEXT,
      forecastDocument TEXT,
      consistencyStatus TEXT,
      originId TEXT,
      originalAmount REAL,
      discountAmount REAL,
      taxAmount REAL,
      indexerId INTEGER,
      indexerName TEXT,
      dueDate TEXT,
      issueDate TEXT,
      installmentBaseDate TEXT,
      balanceAmount REAL,
      correctedBalanceAmount REAL,
      authorizationStatus TEXT,
      billDate TEXT,
      registeredUserId TEXT,
      registeredBy TEXT,
      registeredDate TEXT,
      raw_json TEXT NOT NULL,
      source_endpoint TEXT NOT NULL,
      source_query_json TEXT NOT NULL,
      source_day TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (tenant, billId, installmentId)
    );

    CREATE TABLE IF NOT EXISTS bulk_outcome_payments_categories (
      tenant TEXT NOT NULL,
      billId INTEGER NOT NULL,
      installmentId INTEGER NOT NULL,
      rowIndex INTEGER NOT NULL,
      costCenterId INTEGER,
      costCenterName TEXT,
      projectId INTEGER,
      projectName TEXT,
      financialCategoryId TEXT,
      financialCategoryName TEXT,
      financialCategoryReducer TEXT,
      financialCategoryType TEXT,
      financialCategoryRate REAL,
      raw_json TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (tenant, billId, installmentId, rowIndex)
    );

    CREATE TABLE IF NOT EXISTS bulk_outcome_departaments_costs (
      tenant TEXT NOT NULL,
      billId INTEGER NOT NULL,
      installmentId INTEGER NOT NULL,
      rowIndex INTEGER NOT NULL,
      id INTEGER,
      name TEXT,
      rate REAL,
      raw_json TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (tenant, billId, installmentId, rowIndex)
    );

    CREATE TABLE IF NOT EXISTS bulk_outcome_buildings_costs (
      tenant TEXT NOT NULL,
      billId INTEGER NOT NULL,
      installmentId INTEGER NOT NULL,
      rowIndex INTEGER NOT NULL,
      buildingId INTEGER,
      buildingName TEXT,
      buildingUnitId INTEGER,
      buildingUnitName TEXT,
      costEstimationSheetId TEXT,
      costEstimationSheetName TEXT,
      rate REAL,
      raw_json TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (tenant, billId, installmentId, rowIndex)
    );

    CREATE TABLE IF NOT EXISTS bulk_outcome_payments (
      tenant TEXT NOT NULL,
      billId INTEGER NOT NULL,
      installmentId INTEGER NOT NULL,
      rowIndex INTEGER NOT NULL,
      operationTypeId INTEGER,
      operationTypeName TEXT,
      grossAmount REAL,
      monetaryCorrectionAmount REAL,
      interestAmount REAL,
      fineAmount REAL,
      discountAmount REAL,
      taxAmount REAL,
      netAmount REAL,
      calculationDate TEXT,
      paymentDate TEXT,
      sequencialNumber INTEGER,
      correctedNetAmount REAL,
      paymentAuthentication TEXT,
      raw_json TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (tenant, billId, installmentId, rowIndex)
    );

    CREATE TABLE IF NOT EXISTS bulk_outcome_bank_movements (
      tenant TEXT NOT NULL,
      billId INTEGER NOT NULL,
      installmentId INTEGER NOT NULL,
      paymentIndex INTEGER NOT NULL,
      rowIndex INTEGER NOT NULL,
      accountCompanyId INTEGER,
      accountNumber TEXT,
      accountType TEXT,
      bankMovementDate TEXT,
      sequencialNumber INTEGER,
      id INTEGER,
      amount REAL,
      historicId INTEGER,
      historicName TEXT,
      operationId INTEGER,
      operationName TEXT,
      operationType TEXT,
      reconcile TEXT,
      originId TEXT,
      raw_json TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (tenant, billId, installmentId, paymentIndex, rowIndex)
    );

    CREATE TABLE IF NOT EXISTS bulk_outcome_bank_movement_categories (
      tenant TEXT NOT NULL,
      billId INTEGER NOT NULL,
      installmentId INTEGER NOT NULL,
      paymentIndex INTEGER NOT NULL,
      bankMovementIndex INTEGER NOT NULL,
      rowIndex INTEGER NOT NULL,
      costCenterId INTEGER,
      financialCategoryId TEXT,
      financialCategoryName TEXT,
      financialCategoryReducer TEXT,
      financialCategoryType TEXT,
      financialCategoryRate REAL,
      bankMovementId INTEGER,
      raw_json TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (tenant, billId, installmentId, paymentIndex, bankMovementIndex, rowIndex)
    );

    CREATE TABLE IF NOT EXISTS bulk_outcome_authorizations (
      tenant TEXT NOT NULL,
      billId INTEGER NOT NULL,
      installmentId INTEGER NOT NULL,
      rowIndex INTEGER NOT NULL,
      authorizationUserId TEXT,
      authorizationUserName TEXT,
      authorizationDate TEXT,
      isLastToAuthorize TEXT,
      raw_json TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (tenant, billId, installmentId, rowIndex)
    );

    CREATE INDEX IF NOT EXISTS idx_bulk_outcome_installments_dueDate ON bulk_outcome_installments(dueDate);
    CREATE INDEX IF NOT EXISTS idx_bulk_outcome_installments_creditorId ON bulk_outcome_installments(creditorId);
    CREATE INDEX IF NOT EXISTS idx_bulk_outcome_installments_billId ON bulk_outcome_installments(billId);
  `);
}

function clearOutcomeChildren(database: DatabaseSync, tenant: string, billId: number, installmentId: number) {
  for (const table of [
    "bulk_outcome_payments_categories",
    "bulk_outcome_departaments_costs",
    "bulk_outcome_buildings_costs",
    "bulk_outcome_payments",
    "bulk_outcome_bank_movements",
    "bulk_outcome_bank_movement_categories",
    "bulk_outcome_authorizations"
  ]) {
    database.prepare(`DELETE FROM ${table} WHERE tenant = ? AND billId = ? AND installmentId = ?`).run(tenant, billId, installmentId);
  }
}

function insertChildren(database: DatabaseSync, table: string, context: SiengeStoreContext, parent: JsonRecord, key: string, columns: string[]) {
  const billId = Number(parent.billId);
  const installmentId = Number(parent.installmentId);
  const items = Array.isArray(parent[key]) ? parent[key] as JsonRecord[] : [];
  items.forEach((item, index) => {
    runInsert(
      database,
      table,
      ["tenant", "billId", "installmentId", "rowIndex", ...columns, "raw_json", "saved_at"],
      [context.tenant, billId, installmentId, index, ...columns.map((column) => value(item, column)), JSON.stringify(item), context.savedAt]
    );
  });
}

function storeOutcome(database: DatabaseSync, context: SiengeStoreContext, response: unknown, onProgress?: ProgressHandler) {
  createOutcomeTables(database);
  const data = (response as { data?: unknown[] })?.data || [];
  onProgress?.({
    stage: "sqlite-bulk-write",
    message: "Gravando parcelas e baixas do bulk no SQLite.",
    detail: "Tabela bulk_outcome_installments e tabelas filhas",
    current: 0,
    total: data.length
  });
  database.exec("BEGIN");
  try {
    data.forEach((item, index) => {
      if (index === 0 || index % 250 === 0 || index === data.length - 1) {
        onProgress?.({
          stage: "sqlite-bulk-write",
          message: "Gravando parcelas e baixas do bulk no SQLite.",
          detail: `Registro ${index + 1} de ${data.length}`,
          current: index + 1,
          total: data.length
        });
      }
      if (!item || typeof item !== "object") return;
      const installment = item as JsonRecord;
      const billId = Number(installment.billId);
      const installmentId = Number(installment.installmentId);
      if (!Number.isFinite(billId) || !Number.isFinite(installmentId)) return;

      clearOutcomeChildren(database, context.tenant, billId, installmentId);
      const installmentColumns = [
        "companyId", "companyName", "businessAreaId", "businessAreaName", "projectId", "projectName",
        "groupCompanyId", "groupCompanyName", "holdingId", "holdingName", "subsidiaryId", "subsidiaryName",
        "businessTypeId", "businessTypeName", "creditorId", "creditorName", "billId", "installmentId",
        "documentIdentificationId", "documentIdentificationName", "documentNumber", "forecastDocument",
        "consistencyStatus", "originId", "originalAmount", "discountAmount", "taxAmount", "indexerId",
        "indexerName", "dueDate", "issueDate", "installmentBaseDate", "balanceAmount", "correctedBalanceAmount",
        "authorizationStatus", "billDate", "registeredUserId", "registeredBy", "registeredDate"
      ];
      runInsert(
        database,
        "bulk_outcome_installments",
        ["tenant", ...installmentColumns, "raw_json", "source_endpoint", "source_query_json", "source_day", "saved_at"],
        [context.tenant, ...installmentColumns.map((column) => value(installment, column)), JSON.stringify(installment), context.endpoint, context.queryJson, context.day, context.savedAt]
      );

      insertChildren(database, "bulk_outcome_payments_categories", context, installment, "paymentsCategories", [
        "costCenterId", "costCenterName", "projectId", "projectName", "financialCategoryId", "financialCategoryName",
        "financialCategoryReducer", "financialCategoryType", "financialCategoryRate"
      ]);
      insertChildren(database, "bulk_outcome_departaments_costs", context, installment, "departamentsCosts", ["id", "name", "rate"]);
      insertChildren(database, "bulk_outcome_buildings_costs", context, installment, "buildingsCosts", [
        "buildingId", "buildingName", "buildingUnitId", "buildingUnitName", "costEstimationSheetId", "costEstimationSheetName", "rate"
      ]);
      insertChildren(database, "bulk_outcome_authorizations", context, installment, "authorizations", [
        "authorizationUserId", "authorizationUserName", "authorizationDate", "isLastToAuthorize"
      ]);

      const payments = Array.isArray(installment.payments) ? installment.payments as JsonRecord[] : [];
      payments.forEach((payment, paymentIndex) => {
        runInsert(database, "bulk_outcome_payments", [
          "tenant", "billId", "installmentId", "rowIndex", "operationTypeId", "operationTypeName", "grossAmount",
          "monetaryCorrectionAmount", "interestAmount", "fineAmount", "discountAmount", "taxAmount", "netAmount",
          "calculationDate", "paymentDate", "sequencialNumber", "correctedNetAmount", "paymentAuthentication", "raw_json", "saved_at"
        ], [
          context.tenant, billId, installmentId, paymentIndex, value(payment, "operationTypeId"), value(payment, "operationTypeName"),
          value(payment, "grossAmount"), value(payment, "monetaryCorrectionAmount"), value(payment, "interestAmount"),
          value(payment, "fineAmount"), value(payment, "discountAmount"), value(payment, "taxAmount"), value(payment, "netAmount"),
          value(payment, "calculationDate"), value(payment, "paymentDate"), value(payment, "sequencialNumber"),
          value(payment, "correctedNetAmount"), value(payment, "paymentAuthentication"), JSON.stringify(payment), context.savedAt
        ]);

        const movements = Array.isArray(payment.bankMovements) ? payment.bankMovements as JsonRecord[] : [];
        movements.forEach((movement, movementIndex) => {
          runInsert(database, "bulk_outcome_bank_movements", [
            "tenant", "billId", "installmentId", "paymentIndex", "rowIndex", "accountCompanyId", "accountNumber",
            "accountType", "bankMovementDate", "sequencialNumber", "id", "amount", "historicId", "historicName",
            "operationId", "operationName", "operationType", "reconcile", "originId", "raw_json", "saved_at"
          ], [
            context.tenant, billId, installmentId, paymentIndex, movementIndex, value(movement, "accountCompanyId"),
            value(movement, "accountNumber"), value(movement, "accountType"), value(movement, "bankMovementDate"),
            value(movement, "sequencialNumber"), value(movement, "id"), value(movement, "amount"), value(movement, "historicId"),
            value(movement, "historicName"), value(movement, "operationId"), value(movement, "operationName"),
            value(movement, "operationType"), value(movement, "reconcile"), value(movement, "originId"), JSON.stringify(movement), context.savedAt
          ]);

          const categories = Array.isArray(movement.paymentCategories) ? movement.paymentCategories as JsonRecord[] : [];
          categories.forEach((category, categoryIndex) => {
            runInsert(database, "bulk_outcome_bank_movement_categories", [
              "tenant", "billId", "installmentId", "paymentIndex", "bankMovementIndex", "rowIndex", "costCenterId",
              "financialCategoryId", "financialCategoryName", "financialCategoryReducer", "financialCategoryType",
              "financialCategoryRate", "bankMovementId", "raw_json", "saved_at"
            ], [
              context.tenant, billId, installmentId, paymentIndex, movementIndex, categoryIndex, value(category, "costCenterId"),
              value(category, "financialCategoryId"), value(category, "financialCategoryName"), value(category, "financialCategoryReducer"),
              value(category, "financialCategoryType"), value(category, "financialCategoryRate"), value(category, "bankMovementId"),
              JSON.stringify(category), context.savedAt
            ]);
          });
        });
      });
    });
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function createIncomeTables(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS bulk_income_installments (
      tenant TEXT NOT NULL,
      billId INTEGER NOT NULL,
      installmentId INTEGER NOT NULL,
      companyId INTEGER,
      companyName TEXT,
      businessAreaId INTEGER,
      businessAreaName TEXT,
      projectId INTEGER,
      projectName TEXT,
      groupCompanyId INTEGER,
      groupCompanyName TEXT,
      holdingId INTEGER,
      holdingName TEXT,
      subsidiaryId INTEGER,
      subsidiaryName TEXT,
      businessTypeId INTEGER,
      businessTypeName TEXT,
      clientId INTEGER,
      clientName TEXT,
      documentIdentificationId TEXT,
      documentIdentificationName TEXT,
      documentNumber TEXT,
      documentForecast TEXT,
      originId TEXT,
      originalAmount REAL,
      discountAmount REAL,
      taxAmount REAL,
      indexerId INTEGER,
      indexerName TEXT,
      dueDate TEXT,
      issueDate TEXT,
      billDate TEXT,
      installmentBaseDate TEXT,
      balanceAmount REAL,
      correctedBalanceAmount REAL,
      periodicityType TEXT,
      embeddedInterestAmount REAL,
      interestType TEXT,
      interestRate REAL,
      correctionType TEXT,
      interestBaseDate TEXT,
      defaulterSituation TEXT,
      subJudicie TEXT,
      mainUnit TEXT,
      installmentNumber TEXT,
      bearerId INTEGER,
      raw_json TEXT NOT NULL,
      source_endpoint TEXT NOT NULL,
      source_query_json TEXT NOT NULL,
      source_day TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (tenant, billId, installmentId)
    );

    CREATE TABLE IF NOT EXISTS bulk_income_receipts_categories (
      tenant TEXT NOT NULL,
      billId INTEGER NOT NULL,
      installmentId INTEGER NOT NULL,
      rowIndex INTEGER NOT NULL,
      costCenterId INTEGER,
      projectId INTEGER,
      businessTypeId INTEGER,
      businessAreaId INTEGER,
      costCenterName TEXT,
      financialCategoryId TEXT,
      financialCategoryName TEXT,
      businessTypeName TEXT,
      businessAreaName TEXT,
      financialCategoryReducer TEXT,
      financialCategoryType TEXT,
      financialCategoryRate REAL,
      raw_json TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (tenant, billId, installmentId, rowIndex)
    );

    CREATE TABLE IF NOT EXISTS bulk_income_receipts (
      tenant TEXT NOT NULL,
      billId INTEGER NOT NULL,
      installmentId INTEGER NOT NULL,
      rowIndex INTEGER NOT NULL,
      operationTypeId INTEGER,
      operationTypeName TEXT,
      grossAmount REAL,
      monetaryCorrectionAmount REAL,
      interestAmount REAL,
      fineAmount REAL,
      discountAmount REAL,
      taxAmount REAL,
      netAmount REAL,
      additionAmount REAL,
      insuranceAmount REAL,
      dueAdmAmount REAL,
      calculationDate TEXT,
      paymentDate TEXT,
      accountCompanyId INTEGER,
      accountNumber TEXT,
      accountType TEXT,
      sequencialNumber INTEGER,
      indexerId INTEGER,
      embeddedInterestAmount REAL,
      proRata REAL,
      raw_json TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (tenant, billId, installmentId, rowIndex)
    );

    CREATE TABLE IF NOT EXISTS bulk_income_bank_movements (
      tenant TEXT NOT NULL,
      billId INTEGER NOT NULL,
      installmentId INTEGER NOT NULL,
      receiptIndex INTEGER NOT NULL,
      rowIndex INTEGER NOT NULL,
      bankMovementDate TEXT,
      sequencialNumber INTEGER,
      id INTEGER,
      amount REAL,
      historicId INTEGER,
      historicName TEXT,
      operationId INTEGER,
      operationName TEXT,
      operationType TEXT,
      reconcile TEXT,
      correctedAmount REAL,
      originId TEXT,
      raw_json TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (tenant, billId, installmentId, receiptIndex, rowIndex)
    );

    CREATE TABLE IF NOT EXISTS bulk_income_bank_movement_categories (
      tenant TEXT NOT NULL,
      billId INTEGER NOT NULL,
      installmentId INTEGER NOT NULL,
      receiptIndex INTEGER NOT NULL,
      bankMovementIndex INTEGER NOT NULL,
      rowIndex INTEGER NOT NULL,
      costCenterId INTEGER,
      projectId INTEGER,
      businessTypeId INTEGER,
      businessAreaId INTEGER,
      costCenterName TEXT,
      financialCategoryId TEXT,
      financialCategoryName TEXT,
      businessTypeName TEXT,
      businessAreaName TEXT,
      financialCategoryReducer TEXT,
      financialCategoryType TEXT,
      financialCategoryRate REAL,
      bankMovementId INTEGER,
      raw_json TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (tenant, billId, installmentId, receiptIndex, bankMovementIndex, rowIndex)
    );

    CREATE INDEX IF NOT EXISTS idx_bulk_income_installments_dueDate ON bulk_income_installments(dueDate);
    CREATE INDEX IF NOT EXISTS idx_bulk_income_installments_clientId ON bulk_income_installments(clientId);
    CREATE INDEX IF NOT EXISTS idx_bulk_income_installments_billId ON bulk_income_installments(billId);
  `);
}

function clearIncomeChildren(database: DatabaseSync, tenant: string, billId: number, installmentId: number) {
  for (const table of [
    "bulk_income_receipts_categories",
    "bulk_income_receipts",
    "bulk_income_bank_movements",
    "bulk_income_bank_movement_categories"
  ]) {
    database.prepare(`DELETE FROM ${table} WHERE tenant = ? AND billId = ? AND installmentId = ?`).run(tenant, billId, installmentId);
  }
}

function storeIncome(database: DatabaseSync, context: SiengeStoreContext, response: unknown, onProgress?: ProgressHandler) {
  createIncomeTables(database);
  const data = (response as { data?: unknown[] })?.data || [];
  onProgress?.({
    stage: "sqlite-bulk-write",
    message: "Gravando parcelas e baixas a receber no SQLite.",
    detail: "Tabela bulk_income_installments e tabelas filhas",
    current: 0,
    total: data.length
  });
  database.exec("BEGIN");
  try {
    data.forEach((item, index) => {
      if (index === 0 || index % 250 === 0 || index === data.length - 1) {
        onProgress?.({
          stage: "sqlite-bulk-write",
          message: "Gravando parcelas e baixas a receber no SQLite.",
          detail: `Registro ${index + 1} de ${data.length}`,
          current: index + 1,
          total: data.length
        });
      }
      if (!item || typeof item !== "object") return;
      const installment = item as JsonRecord;
      const billId = Number(installment.billId);
      const installmentId = Number(installment.installmentId);
      if (!Number.isFinite(billId) || !Number.isFinite(installmentId)) return;

      clearIncomeChildren(database, context.tenant, billId, installmentId);
      const installmentColumns = [
        "companyId", "companyName", "businessAreaId", "businessAreaName", "projectId", "projectName",
        "groupCompanyId", "groupCompanyName", "holdingId", "holdingName", "subsidiaryId", "subsidiaryName",
        "businessTypeId", "businessTypeName", "clientId", "clientName", "billId", "installmentId",
        "documentIdentificationId", "documentIdentificationName", "documentNumber", "documentForecast",
        "originId", "originalAmount", "discountAmount", "taxAmount", "indexerId", "indexerName", "dueDate",
        "issueDate", "billDate", "installmentBaseDate", "balanceAmount", "correctedBalanceAmount",
        "periodicityType", "embeddedInterestAmount", "interestType", "interestRate", "correctionType",
        "interestBaseDate", "defaulterSituation", "subJudicie", "mainUnit", "installmentNumber", "bearerId"
      ];
      runInsert(
        database,
        "bulk_income_installments",
        ["tenant", ...installmentColumns, "raw_json", "source_endpoint", "source_query_json", "source_day", "saved_at"],
        [context.tenant, ...installmentColumns.map((column) => value(installment, column)), JSON.stringify(installment), context.endpoint, context.queryJson, context.day, context.savedAt]
      );

      insertChildren(database, "bulk_income_receipts_categories", context, installment, "receiptsCategories", [
        "costCenterId", "projectId", "businessTypeId", "businessAreaId", "costCenterName", "financialCategoryId",
        "financialCategoryName", "businessTypeName", "businessAreaName", "financialCategoryReducer",
        "financialCategoryType", "financialCategoryRate"
      ]);

      const receipts = Array.isArray(installment.receipts) ? installment.receipts as JsonRecord[] : [];
      receipts.forEach((receipt, receiptIndex) => {
        runInsert(database, "bulk_income_receipts", [
          "tenant", "billId", "installmentId", "rowIndex", "operationTypeId", "operationTypeName", "grossAmount",
          "monetaryCorrectionAmount", "interestAmount", "fineAmount", "discountAmount", "taxAmount", "netAmount",
          "additionAmount", "insuranceAmount", "dueAdmAmount", "calculationDate", "paymentDate", "accountCompanyId",
          "accountNumber", "accountType", "sequencialNumber", "indexerId", "embeddedInterestAmount", "proRata",
          "raw_json", "saved_at"
        ], [
          context.tenant, billId, installmentId, receiptIndex, value(receipt, "operationTypeId"), value(receipt, "operationTypeName"),
          value(receipt, "grossAmount"), value(receipt, "monetaryCorrectionAmount"), value(receipt, "interestAmount"),
          value(receipt, "fineAmount"), value(receipt, "discountAmount"), value(receipt, "taxAmount"), value(receipt, "netAmount"),
          value(receipt, "additionAmount"), value(receipt, "insuranceAmount"), value(receipt, "dueAdmAmount"),
          value(receipt, "calculationDate"), value(receipt, "paymentDate"), value(receipt, "accountCompanyId"),
          value(receipt, "accountNumber"), value(receipt, "accountType"), value(receipt, "sequencialNumber"),
          value(receipt, "indexerId"), value(receipt, "embeddedInterestAmount"), value(receipt, "proRata"),
          JSON.stringify(receipt), context.savedAt
        ]);

        const movements = Array.isArray(receipt.bankMovements) ? receipt.bankMovements as JsonRecord[] : [];
        movements.forEach((movement, movementIndex) => {
          runInsert(database, "bulk_income_bank_movements", [
            "tenant", "billId", "installmentId", "receiptIndex", "rowIndex", "bankMovementDate", "sequencialNumber",
            "id", "amount", "historicId", "historicName", "operationId", "operationName", "operationType",
            "reconcile", "correctedAmount", "originId", "raw_json", "saved_at"
          ], [
            context.tenant, billId, installmentId, receiptIndex, movementIndex, value(movement, "bankMovementDate"),
            value(movement, "sequencialNumber"), value(movement, "id"), value(movement, "amount"),
            value(movement, "historicId"), value(movement, "historicName"), value(movement, "operationId"),
            value(movement, "operationName"), value(movement, "operationType"), value(movement, "reconcile"),
            value(movement, "correctedAmount"), value(movement, "originId"), JSON.stringify(movement), context.savedAt
          ]);

          const categories = Array.isArray(movement.financialCategories) ? movement.financialCategories as JsonRecord[] : [];
          categories.forEach((category, categoryIndex) => {
            runInsert(database, "bulk_income_bank_movement_categories", [
              "tenant", "billId", "installmentId", "receiptIndex", "bankMovementIndex", "rowIndex", "costCenterId",
              "projectId", "businessTypeId", "businessAreaId", "costCenterName", "financialCategoryId",
              "financialCategoryName", "businessTypeName", "businessAreaName", "financialCategoryReducer",
              "financialCategoryType", "financialCategoryRate", "bankMovementId", "raw_json", "saved_at"
            ], [
              context.tenant, billId, installmentId, receiptIndex, movementIndex, categoryIndex, value(category, "costCenterId"),
              value(category, "projectId"), value(category, "businessTypeId"), value(category, "businessAreaId"),
              value(category, "costCenterName"), value(category, "financialCategoryId"), value(category, "financialCategoryName"),
              value(category, "businessTypeName"), value(category, "businessAreaName"), value(category, "financialCategoryReducer"),
              value(category, "financialCategoryType"), value(category, "financialCategoryRate"), value(category, "bankMovementId"),
              JSON.stringify(category), context.savedAt
            ]);
          });
        });
      });
    });
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function createGenericRecordTable(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS sienge_records (
      tenant TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      record_key TEXT NOT NULL,
      record_type TEXT NOT NULL,
      record_id TEXT,
      source_query_json TEXT NOT NULL,
      source_day TEXT NOT NULL,
      raw_json TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (tenant, endpoint, record_key)
    );
    CREATE INDEX IF NOT EXISTS idx_sienge_records_endpoint ON sienge_records(endpoint);
    CREATE INDEX IF NOT EXISTS idx_sienge_records_record_type ON sienge_records(record_type);
    CREATE INDEX IF NOT EXISTS idx_sienge_records_record_id ON sienge_records(record_id);
  `);
}

function hashJson(value: unknown) {
  let hash = 0;
  const text = JSON.stringify(value);
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function recordId(item: JsonRecord) {
  const candidates = [
    "id",
    "bankMovementId",
    "billId",
    "installmentId",
    "receivableBillId",
    "contractId",
    "patrimonyId",
    "purchaseOrderId",
    "purchaseRequestId",
    "purchaseQuotationId",
    "sequentialNumber",
    "itemNumber",
    "creditorId",
    "customerId",
    "enterpriseId",
    "buildingId",
    "buildingUnitId"
  ];
  const parts = candidates
    .filter((key) => item[key] !== undefined && item[key] !== null)
    .map((key) => `${key}:${String(item[key])}`);
  return parts.length ? parts.join("|") : undefined;
}

function responseItems(response: unknown) {
  if (!response || typeof response !== "object") return [];
  const record = response as { results?: unknown[]; data?: unknown[] };
  if (Array.isArray(record.results)) return record.results;
  if (Array.isArray(record.data)) return record.data;
  return [response];
}

function recordType(endpoint: string) {
  return endpoint
    .replace(/^\/+/, "")
    .replace(/\/\d+(?=\/|$)/g, "/:id")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function storeGenericResponseRecords(database: DatabaseSync, context: SiengeStoreContext, response: unknown, onProgress?: ProgressHandler) {
  createGenericRecordTable(database);
  const type = recordType(context.endpoint);
  const items = responseItems(response);
  onProgress?.({
    stage: "sqlite-records-write",
    message: "Gravando registros únicos no SQLite.",
    detail: `Tipo ${type}`,
    current: 0,
    total: items.length
  });
  items.forEach((item, index) => {
    if (index === 0 || index % 250 === 0 || index === items.length - 1) {
      onProgress?.({
        stage: "sqlite-records-write",
        message: "Gravando registros únicos no SQLite.",
        detail: `Registro ${index + 1} de ${items.length}`,
        current: index + 1,
        total: items.length
      });
    }
    if (!item || typeof item !== "object") return;
    const json = JSON.stringify(item);
    const id = recordId(item as JsonRecord);
    const key = id || `item:${index}:${hashJson(item)}`;
    runInsert(database, "sienge_records", [
      "tenant",
      "endpoint",
      "record_key",
      "record_type",
      "record_id",
      "source_query_json",
      "source_day",
      "raw_json",
      "saved_at"
    ], [
      context.tenant,
      context.endpoint,
      key,
      type,
      id ?? null,
      context.queryJson,
      context.day,
      json,
      context.savedAt
    ]);
  });
}

export function storeBulkResponse(database: DatabaseSync, context: SiengeStoreContext, response: unknown, onProgress?: ProgressHandler) {
  if (context.endpoint === "/bulk-data/v1/outcome") {
    storeOutcome(database, context, response, onProgress);
  }
  if (context.endpoint === "/bulk-data/v1/income") {
    storeIncome(database, context, response, onProgress);
  }
}
