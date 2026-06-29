import "server-only";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { writeFile } from "fs/promises";
import path from "path";
import { spawn, spawnSync } from "child_process";

export type SiengeDumpImportStep = {
  key: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  message?: string;
  startedAt?: string;
  finishedAt?: string;
};

export type SiengeDumpImportJob = {
  id: string;
  status: "idle" | "running" | "completed" | "failed";
  sourceFileName?: string;
  sqlitePath?: string;
  startedAt?: string;
  updatedAt?: string;
  finishedAt?: string;
  message: string;
  error?: string;
  tableCount?: number;
  rowCount?: number;
  operationalCounts?: Record<string, number>;
  steps: SiengeDumpImportStep[];
};

const dataDir = path.join(process.cwd(), ".sienge-data");
const importsDir = path.join(dataDir, "imports");
const statusPath = path.join(dataDir, "dump-import-status.json");
const scriptPath = path.join(process.cwd(), "scripts", "import-sienge-dump.py");
const sqlitePath = path.join(dataDir, "sienge-dump.sqlite");

function now() {
  return new Date().toISOString();
}

function defaultSteps(): SiengeDumpImportStep[] {
  return [
    { key: "validate", label: "Validar arquivo", status: "pending", message: "Aguardando arquivo." },
    { key: "tools", label: "Preparar ferramentas locais", status: "pending", message: "Aguardando PostgreSQL local." },
    { key: "restore", label: "Restaurar dump", status: "pending", message: "Aguardando importação temporária." },
    { key: "catalog", label: "Ler catálogo", status: "pending", message: "Aguardando tabelas e colunas." },
    { key: "sqlite", label: "Gerar SQLite", status: "pending", message: "Aguardando conversão." },
    { key: "finalize", label: "Publicar dados", status: "pending", message: "Aguardando validação final." }
  ];
}

function emptyJob(): SiengeDumpImportJob {
  return {
    id: "idle",
    status: "idle",
    sqlitePath,
    message: "Nenhuma importação de dump em andamento.",
    steps: defaultSteps()
  };
}

function ensureDataDir() {
  mkdirSync(importsDir, { recursive: true });
}

function writeStatus(job: SiengeDumpImportJob) {
  ensureDataDir();
  writeFileSync(statusPath, JSON.stringify({ ...job, updatedAt: now() }, null, 2), "utf-8");
}

export function getDumpImportStatus(): SiengeDumpImportJob {
  if (!existsSync(statusPath)) return emptyJob();
  try {
    const parsed = JSON.parse(readFileSync(statusPath, "utf-8")) as SiengeDumpImportJob;
    return {
      ...emptyJob(),
      ...parsed,
      steps: parsed.steps?.length ? parsed.steps : defaultSteps()
    };
  } catch {
    return {
      ...emptyJob(),
      status: "failed",
      message: "Não foi possível ler o status da última importação.",
      error: "Arquivo de status inválido."
    };
  }
}

export function getDumpSqliteInfo() {
  if (!existsSync(sqlitePath)) return undefined;
  const stats = statSync(sqlitePath);
  return {
    path: sqlitePath,
    sizeBytes: stats.size,
    updatedAt: stats.mtime.toISOString()
  };
}

function pythonCandidates() {
  const envPython = process.env.SIENGE_DUMP_PYTHON || process.env.PYTHON;
  const bundledPython = process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "python.exe")
    : undefined;
  return [
    ...(envPython ? [{ command: envPython, args: [] as string[] }] : []),
    ...(bundledPython ? [{ command: bundledPython, args: [] as string[] }] : []),
    { command: "python", args: [] as string[] },
    { command: "py", args: ["-3"] }
  ];
}

function findPython() {
  for (const candidate of pythonCandidates()) {
    const result = spawnSync(candidate.command, [...candidate.args, "--version"], { encoding: "utf-8" });
    if (result.status === 0) return candidate;
  }
  throw new Error("Não encontrei Python para executar a conversão. Configure SIENGE_DUMP_PYTHON ou instale Python 3 localmente.");
}

function safeUploadName(originalName: string) {
  const base = path.basename(originalName || "sienge-dump.dmpc").replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${new Date().toISOString().replace(/[:.]/g, "-")}-${base}`;
}

export async function startDumpImport(file: File) {
  const current = getDumpImportStatus();
  if (current.status === "running") {
    return { started: false, job: current };
  }
  if (!file || file.size === 0) {
    throw new Error("Selecione um arquivo de dump do Sienge.");
  }

  const python = findPython();
  ensureDataDir();
  const jobId = randomUUID();
  const uploadPath = path.join(importsDir, safeUploadName(file.name));
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(uploadPath, buffer);

  const initialJob: SiengeDumpImportJob = {
    id: jobId,
    status: "running",
    sourceFileName: file.name,
    sqlitePath,
    startedAt: now(),
    updatedAt: now(),
    message: "Arquivo recebido. A importação vai rodar em segundo plano.",
    steps: defaultSteps()
  };
  writeStatus(initialJob);

  const child = spawn(
    python.command,
    [
      ...python.args,
      scriptPath,
      "--dump",
      uploadPath,
      "--output",
      sqlitePath,
      "--status",
      statusPath,
      "--job-id",
      jobId,
      "--source-name",
      file.name,
      "--data-dir",
      dataDir
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "ignore",
      windowsHide: true
    }
  );

  child.on("error", (error) => {
    writeStatus({
      ...getDumpImportStatus(),
      id: jobId,
      status: "failed",
      message: error.message,
      error: error.message,
      finishedAt: now()
    });
  });

  child.on("close", (code) => {
    const latest = getDumpImportStatus();
    if (latest.id !== jobId || latest.status !== "running") return;
    const message = code === 0
      ? "Importação concluída."
      : "A importação foi encerrada antes de concluir. Veja a etapa marcada com erro.";
    writeStatus({
      ...latest,
      status: code === 0 ? "completed" : "failed",
      message,
      error: code === 0 ? undefined : message,
      finishedAt: now()
    });
  });

  child.unref();
  return { started: true, job: getDumpImportStatus() };
}
