"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { updateAreas } from "@/lib/sienge-update-areas";
import type { UpdateAreaStatus } from "@/lib/sienge-update-status";

type Area = (typeof updateAreas)[number];

type SiengeUpdateControlsProps = {
  areas: Area[];
  statuses: Record<string, UpdateAreaStatus>;
  showForce?: boolean;
};

type JobsResponse = {
  active?: SiengeUpdateJob;
  jobs: SiengeUpdateJob[];
};

type SiengeUpdateJob = {
  id: string;
  area: string;
  areaLabel: string;
  force: boolean;
  status: "running" | "completed" | "failed";
  message: string;
  startedAt: string;
  finishedAt?: string;
  steps: Array<{
    key: string;
    label: string;
    status: "pending" | "running" | "completed" | "failed";
    message?: string;
    startedAt?: string;
    finishedAt?: string;
  }>;
};

function formatDate(value?: string) {
  if (!value) return "Nunca atualizado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusLabel(status: UpdateAreaStatus["status"]) {
  if (status === "updated") return "Pronto";
  if (status === "warning") return "Com aviso";
  return "Sem dados";
}

function jobStatusLabel(status: SiengeUpdateJob["status"]) {
  if (status === "completed") return "Concluída";
  if (status === "failed") return "Com erro";
  return "Atualizando";
}

function stepStatusLabel(status: SiengeUpdateJob["steps"][number]["status"]) {
  if (status === "completed") return "Feita";
  if (status === "failed") return "Erro";
  if (status === "running") return "Em andamento";
  return "Pendente";
}

export function SiengeUpdateControls({ areas, statuses, showForce = true }: SiengeUpdateControlsProps) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobsResponse>({ jobs: [] });
  const [startingKey, setStartingKey] = useState<string>();
  const [message, setMessage] = useState<string>();
  const observedActiveJobId = useRef<string>();

  const activeJob = jobs.active;
  const latestJob = activeJob || jobs.jobs[0];

  const completedSteps = useMemo(() => {
    if (!latestJob) return 0;
    return latestJob.steps.filter((step) => step.status === "completed").length;
  }, [latestJob]);

  async function refreshJobs() {
    const response = await fetch("/api/sienge/update-jobs", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as JobsResponse;
    setJobs(data);
  }

  async function start(area: string, force: boolean) {
    setStartingKey(`${area}-${force}`);
    setMessage(undefined);
    try {
      const response = await fetch("/api/sienge/update-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, force })
      });
      const data = await response.json() as { started: boolean; job?: SiengeUpdateJob };
      if (!data.started) {
        setMessage("Já existe uma atualização em andamento. Aguarde ela terminar antes de iniciar outra.");
      } else {
        observedActiveJobId.current = data.job?.id;
        setMessage("Atualização iniciada em segundo plano. Você pode continuar usando o sistema.");
      }
      await refreshJobs();
    } catch {
      setMessage("Não foi possível iniciar a atualização agora.");
    } finally {
      setStartingKey(undefined);
    }
  }

  useEffect(() => {
    void refreshJobs();
  }, []);

  useEffect(() => {
    if (!activeJob) return;
    observedActiveJobId.current = activeJob.id;
    const timer = window.setInterval(() => {
      void refreshJobs();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [activeJob?.id]);

  useEffect(() => {
    if (!latestJob?.finishedAt) return;
    if (latestJob.id !== observedActiveJobId.current) return;
    observedActiveJobId.current = undefined;
    router.refresh();
  }, [latestJob?.id, latestJob?.finishedAt, router]);

  return (
    <div className="settings-update-control">
      {latestJob && (
        <section className={`settings-job-card ${latestJob.status}`}>
          <div className="settings-job-head">
            <div>
              <span><I18nText text={jobStatusLabel(latestJob.status)} /></span>
              <strong><I18nText text={latestJob.areaLabel} /></strong>
              <small><I18nText text={latestJob.message} /></small>
            </div>
            <div>
              <strong>{completedSteps}<I18nText text={"/"} />{latestJob.steps.length}</strong>
              <small><I18nText text={"etapas feitas"} /></small>
            </div>
          </div>
          <div className="settings-job-steps">
            {latestJob.steps.map((step) => (
              <div key={step.key} className={step.status}>
                <b><I18nText text={stepStatusLabel(step.status)} /></b>
                <span><I18nText text={step.label} /></span>
                {step.message && <small><I18nText text={step.message} /></small>}
              </div>
            ))}
          </div>
        </section>
      )}

      {message && <div className="settings-inline-message"><I18nText text={message} /></div>}

      <div className="settings-area-grid">
        {areas.map((area) => {
          const current = statuses[area.key];
          const isBusy = Boolean(activeJob);
          return (
            <article key={area.key} className={`settings-area-card ${current.status}`}>
              <div className="settings-area-main">
                <span><I18nText text={statusLabel(current.status)} /></span>
                <strong><I18nText text={area.label} /></strong>
                <p><I18nText text={area.note} /></p>
                <small><I18nText text={"Última integração:"} /> {formatDate(current.lastUpdatedAt)}</small>
                <em>{current.successCount} <I18nText text={"atualizações -"} /> {current.errorCount} <I18nText text={"avisos"} /></em>
              </div>
              <div className="settings-area-actions">
                <button
                  className="button"
                  type="button"
                  disabled={isBusy || startingKey === `${area.key}-false`}
                  onClick={() => start(area.key, false)}
                >
                  <I18nText text={startingKey === `${area.key}-false` ? "Iniciando..." : "Atualizar"} />
                </button>
                {showForce && (
                  <button
                    className="button secondary"
                    type="button"
                    disabled={isBusy || startingKey === `${area.key}-true`}
                    onClick={() => start(area.key, true)}
                  >
                    <I18nText text={startingKey === `${area.key}-true` ? "Iniciando..." : "Atualizar com força"} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
