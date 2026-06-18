import "server-only";
import { randomUUID } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export type ReconciliationProgress = {
  id: string;
  active: boolean;
  startedAt?: string;
  updatedAt?: string;
  stage: string;
  message: string;
  detail?: string;
  current?: number;
  total?: number;
  completedAt?: string;
};

const progressDir = path.join(process.cwd(), ".sienge-data");
const progressFile = path.join(progressDir, "reconciliation-progress.json");

function idleProgress(id = "default"): ReconciliationProgress {
  return {
    id,
    active: false,
    stage: "idle",
    message: "Nenhuma leitura de conciliação em andamento."
  };
}

function save(progress: ReconciliationProgress) {
  mkdirSync(progressDir, { recursive: true });
  writeFileSync(progressFile, JSON.stringify(progress), "utf8");
}

export function startReconciliationProgress(id: string = randomUUID()) {
  const now = new Date().toISOString();
  const progress: ReconciliationProgress = {
    id,
    active: true,
    startedAt: now,
    updatedAt: now,
    stage: "start",
    message: "Iniciando leitura de conciliação."
  };
  save(progress);
  return id;
}

export function updateReconciliationProgress(id: string, update: Omit<Partial<ReconciliationProgress>, "active" | "startedAt" | "id">) {
  const previous = getReconciliationProgress(id);
  save({
    ...previous,
    ...update,
    id,
    active: true,
    updatedAt: new Date().toISOString()
  });
}

export function completeReconciliationProgress(id: string, message = "Leitura de conciliação concluída.") {
  const now = new Date().toISOString();
  const previous = getReconciliationProgress(id);
  save({
    ...previous,
    id,
    active: false,
    stage: "done",
    message,
    updatedAt: now,
    completedAt: now
  });
}

export function getReconciliationProgress(id = "default") {
  try {
    const progress = JSON.parse(readFileSync(progressFile, "utf8")) as ReconciliationProgress;
    return progress.id === id || id === "default" ? progress : idleProgress(id);
  } catch {
    return idleProgress(id);
  }
}
