import "server-only";
import { loadPayables } from "@/features/financeiro/sienge-data";
import { loadInventoryAssets } from "@/features/inventory/data";
import { loadPayablesSchedule } from "@/features/payables-schedule/data";
import { loadPurchases } from "@/features/purchases/data";
import { loadReceivablesForecast } from "@/features/receivables-forecast/sienge-data";
import { loadReconciliationMovements } from "@/features/reconciliation/data";
import { loadSalesContracts } from "@/features/sales/data";
import { loadSupplyContracts } from "@/features/contracts/data";
import { refreshSupplierDirectory } from "@/features/suppliers/data";
import { getSiengeIntegrationRange } from "@/lib/settings";
import { updateAreaLabel, type UpdateArea } from "@/lib/sienge-update-areas";

export type SiengeUpdateJobStatus = "running" | "completed" | "failed";

export type SiengeUpdateJobStep = {
  key: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  message?: string;
  startedAt?: string;
  finishedAt?: string;
};

export type SiengeUpdateJob = {
  id: string;
  area: UpdateArea;
  areaLabel: string;
  force: boolean;
  status: SiengeUpdateJobStatus;
  message: string;
  startedAt: string;
  finishedAt?: string;
  steps: SiengeUpdateJobStep[];
};

type JobStore = {
  jobs: SiengeUpdateJob[];
};

const store = (globalThis as typeof globalThis & { __siengeUpdateJobs?: JobStore }).__siengeUpdateJobs
  || ((globalThis as typeof globalThis & { __siengeUpdateJobs?: JobStore }).__siengeUpdateJobs = { jobs: [] });

function now() {
  return new Date().toISOString();
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type RunnableArea = Exclude<UpdateArea, "all" | "reports">;

function stepsFor(area: UpdateArea): SiengeUpdateJobStep[] {
  const keys: Array<{ key: RunnableArea; label: string }> = [
    { key: "payables", label: "Contas a pagar" },
    { key: "receivables", label: "Contas a receber" },
    { key: "sales", label: "Vendas" },
    { key: "contracts", label: "Contratos" },
    { key: "inventory", label: "Estoque e patrimônio" },
    { key: "purchases", label: "Compras" },
    { key: "suppliers", label: "Fornecedores" },
    { key: "reconciliation", label: "Conciliação" }
  ];
  return keys
    .filter((item) => area === "all" || (area === "reports" && item.key !== "reconciliation") || item.key === area)
    .map((item) => ({
      key: item.key,
      label: item.label,
      status: "pending" as const,
      message: "Aguardando atualização."
    }));
}

function activeJob() {
  return store.jobs.find((job) => job.status === "running");
}

function updateStep(job: SiengeUpdateJob, key: string, status: SiengeUpdateJobStep["status"], message: string) {
  const step = job.steps.find((item) => item.key === key);
  if (!step) return;
  step.status = status;
  step.message = message;
  if (status === "running") step.startedAt = now();
  if (status === "completed" || status === "failed") step.finishedAt = now();
}

function taskErrorMessage(result: unknown): string | undefined {
  if (Array.isArray(result)) {
    const messages = result
      .map((item) => {
        if (!item || typeof item !== "object") return undefined;
        if ("status" in item && item.status === "rejected") {
          const reason = (item as PromiseRejectedResult).reason;
          return reason instanceof Error ? reason.message : String(reason || "Falha na atualização.");
        }
        if ("status" in item && item.status === "fulfilled") {
          return taskErrorMessage((item as PromiseFulfilledResult<unknown>).value);
        }
        return taskErrorMessage(item);
      })
      .filter(Boolean);
    return messages.length ? messages.join(" ") : undefined;
  }

  const returnedError = result && typeof result === "object" && "error" in result
    ? (result as { error?: { title?: string; explanation?: string; suggestion?: string } }).error
    : undefined;

  return returnedError
    ? [returnedError.title, returnedError.explanation, returnedError.suggestion].filter(Boolean).join(" ")
    : undefined;
}

async function runStep(job: SiengeUpdateJob, key: RunnableArea, task: () => Promise<unknown>) {
  updateStep(job, key, "running", "Consultando o Sienge e gravando os dados salvos.");
  job.message = `Atualizando ${updateAreaLabel(key)}.`;
  try {
    const result = await task();
    const message = taskErrorMessage(result);
    if (message) {
      throw new Error(message);
    }
    updateStep(job, key, "completed", "Dados atualizados e gravados.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível concluir esta área.";
    updateStep(job, key, "failed", message);
    throw error;
  }
}

async function runSiengeUpdateJob(job: SiengeUpdateJob) {
  const integrationRange = getSiengeIntegrationRange();
  const force = job.force;
  try {
    if (job.area === "payables" || job.area === "all" || job.area === "reports") {
      await runStep(job, "payables", () => Promise.allSettled([
        loadPayables(true, force, integrationRange),
        loadPayablesSchedule(true, force, integrationRange)
      ]));
    }
    if (job.area === "receivables" || job.area === "all" || job.area === "reports") {
      await runStep(job, "receivables", () => loadReceivablesForecast(true, force, integrationRange));
    }
    if (job.area === "sales" || job.area === "all" || job.area === "reports") {
      await runStep(job, "sales", () => loadSalesContracts(true, force));
    }
    if (job.area === "contracts" || job.area === "all" || job.area === "reports") {
      await runStep(job, "contracts", () => loadSupplyContracts(true, force, integrationRange));
    }
    if (job.area === "inventory" || job.area === "all" || job.area === "reports") {
      await runStep(job, "inventory", () => loadInventoryAssets(true, force));
    }
    if (job.area === "purchases" || job.area === "all" || job.area === "reports") {
      await runStep(job, "purchases", () => loadPurchases(true, force, integrationRange));
    }
    if (job.area === "suppliers" || job.area === "all" || job.area === "reports") {
      await runStep(job, "suppliers", () => refreshSupplierDirectory(force));
    }
    if (job.area === "reconciliation" || job.area === "all") {
      await runStep(job, "reconciliation", () => loadReconciliationMovements(undefined, true, force, integrationRange));
    }
    job.status = "completed";
    job.message = "Atualização concluída. As telas já podem usar os dados salvos.";
  } catch {
    job.status = "failed";
    job.message = "A atualização parou antes de concluir todas as áreas.";
  } finally {
    job.finishedAt = now();
    store.jobs = store.jobs.slice(0, 20);
  }
}

export function startSiengeUpdateJob(area: UpdateArea, force: boolean) {
  const current = activeJob();
  if (current) {
    return { started: false, job: current };
  }

  const job: SiengeUpdateJob = {
    id: makeId(),
    area,
    areaLabel: updateAreaLabel(area),
    force,
    status: "running",
    message: `Iniciando atualização de ${updateAreaLabel(area)}.`,
    startedAt: now(),
    steps: stepsFor(area)
  };
  store.jobs.unshift(job);
  void runSiengeUpdateJob(job);
  return { started: true, job };
}

export function getSiengeUpdateJobs() {
  return {
    active: activeJob(),
    jobs: store.jobs.slice(0, 10)
  };
}
