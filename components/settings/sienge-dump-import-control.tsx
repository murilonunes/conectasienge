"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type DumpImportStep = {
  key: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  message?: string;
};

type DumpImportJob = {
  id: string;
  status: "idle" | "running" | "completed" | "failed";
  sourceFileName?: string;
  startedAt?: string;
  finishedAt?: string;
  message: string;
  tableCount?: number;
  rowCount?: number;
  operationalCounts?: Record<string, number>;
  steps: DumpImportStep[];
};

type DumpImportResponse = {
  job: DumpImportJob;
  sqlite?: {
    path: string;
    sizeBytes: number;
    updatedAt: string;
  };
};

function formatDate(value?: string) {
  if (!value) return "Nunca importado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatSize(bytes?: number) {
  if (!bytes) return "0 B";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatNumber(value?: number) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function statusLabel(status: DumpImportJob["status"]) {
  if (status === "running") return "Importando";
  if (status === "completed") return "Concluída";
  if (status === "failed") return "Com erro";
  return "Aguardando";
}

function stepStatusLabel(status: DumpImportStep["status"]) {
  if (status === "completed") return "Feita";
  if (status === "failed") return "Erro";
  if (status === "running") return "Em andamento";
  return "Pendente";
}

export function SiengeDumpImportControl({ initialStatus }: { initialStatus: DumpImportResponse }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const observedJobId = useRef<string>();
  const [payload, setPayload] = useState(initialStatus);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<string>();

  const job = payload.job;
  const completedSteps = useMemo(() => job.steps.filter((step) => step.status === "completed").length, [job.steps]);
  const operationalPreview = Object.entries(job.operationalCounts || {}).slice(0, 6);
  const isBusy = job.status === "running" || starting;

  async function refreshStatus() {
    const response = await fetch("/api/sienge/dump-import", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as DumpImportResponse;
    setPayload(data);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage("Selecione o arquivo .dmpc antes de importar.");
      return;
    }

    setStarting(true);
    try {
      const formData = new FormData();
      formData.append("dump", file);
      const response = await fetch("/api/sienge/dump-import", {
        method: "POST",
        body: formData
      });
      const data = await response.json() as { started?: boolean; job?: DumpImportJob; message?: string };
      if (!response.ok) {
        setMessage(data.message || "Não foi possível iniciar a importação.");
      } else if (!data.started) {
        setMessage("Já existe uma importação em andamento. Aguarde terminar para iniciar outra.");
      } else {
        observedJobId.current = data.job?.id;
        setMessage("Importação iniciada em segundo plano. Você pode continuar usando o sistema.");
        await refreshStatus();
      }
    } catch {
      setMessage("Não foi possível enviar o arquivo agora.");
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  useEffect(() => {
    if (job.status !== "running") return;
    observedJobId.current = job.id;
    const timer = window.setInterval(() => {
      void refreshStatus();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [job.id, job.status]);

  useEffect(() => {
    if (job.status === "running" || job.status === "idle") return;
    if (job.id !== observedJobId.current) return;
    observedJobId.current = undefined;
    router.refresh();
  }, [job.id, job.status, router]);

  return (
    <div className="settings-dump-import">
      <div className="settings-dump-summary">
        <div>
          <span><I18nText text={"SQLite do dump"} /></span>
          <strong>{formatSize(payload.sqlite?.sizeBytes)}</strong>
          <small><I18nText text={"Última importação:"} /> {formatDate(payload.sqlite?.updatedAt)}</small>
        </div>
        <div>
          <span><I18nText text={"Tabelas convertidas"} /></span>
          <strong>{formatNumber(job.tableCount)}</strong>
          <small>{formatNumber(job.rowCount)} <I18nText text={"linhas no último processamento"} /></small>
        </div>
      </div>

      <form className="settings-dump-form" onSubmit={submit}>
        <label>
          <I18nText text={"Arquivo de dump do Sienge"} />
          <input
            ref={fileRef}
            type="file"
            accept=".dmpc,.dump,.backup"
            disabled={isBusy}
            onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name || "")}
          />
        </label>
        <button className="button" type="submit" disabled={isBusy}>
          <I18nText text={isBusy ? "Importando..." : "Importar dump"} />
        </button>
        {selectedFileName && <small><I18nText text={"Selecionado:"} /> {selectedFileName}</small>}
      </form>

      {message && <div className="settings-inline-message"><I18nText text={message} /></div>}

      <section className={`settings-job-card ${job.status === "idle" ? "" : job.status}`}>
        <div className="settings-job-head">
          <div>
            <span><I18nText text={statusLabel(job.status)} /></span>
            <strong>{job.sourceFileName || <I18nText text={"Importação do dump"} />}</strong>
            <small><I18nText text={job.message} /></small>
          </div>
          <div>
            <strong>{completedSteps}<I18nText text={"/"} />{job.steps.length}</strong>
            <small><I18nText text={"etapas feitas"} /></small>
          </div>
        </div>
        <div className="settings-job-steps">
          {job.steps.map((step) => (
            <div key={step.key} className={step.status}>
              <b>{stepStatusLabel(step.status)}</b>
              <span><I18nText text={step.label} /></span>
              {step.message && <small><I18nText text={step.message} /></small>}
            </div>
          ))}
        </div>
      </section>

      {operationalPreview.length > 0 && (
        <div className="settings-dump-operational">
          {operationalPreview.map(([table, count]) => (
            <div key={table}>
              <strong>{table}</strong>
              <span>{formatNumber(count)} <I18nText text={"registros"} /></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
