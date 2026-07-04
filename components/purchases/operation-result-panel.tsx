"use client";

import { useState } from "react";

export type OperationResultKind = "success" | "error" | "info";

function extractResultMessage(json: string): string | undefined {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      if (parsed.length > 1) {
        const okCount = parsed.filter((entry) => entry && typeof entry === "object" && entry.ok).length;
        return `${okCount} de ${parsed.length} operação(ões) concluída(s) com sucesso.`;
      }
      const [first] = parsed;
      return first && typeof first.message === "string" ? first.message : undefined;
    }
    if (parsed && typeof parsed === "object" && typeof parsed.message === "string") {
      return parsed.message;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

const badgeClassByKind: Record<OperationResultKind, string> = { success: "", error: "late", info: "warn" };
const badgeLabelByKind: Record<OperationResultKind, string> = { success: "Sucesso", error: "Erro", info: "Conferência" };

export function OperationResultPanel({
  title,
  kind,
  json
}: {
  title: string;
  kind: OperationResultKind;
  json: string;
}) {
  const [showDetails, setShowDetails] = useState(false);

  if (!json) return null;
  const message = extractResultMessage(json);

  return (
    <div className={`card panel quotation-operation-result quotation-result-${kind}`}>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">{message || title}</h2>
          {message && <span className="panel-note">{title}</span>}
        </div>
        <i className={`badge ${badgeClassByKind[kind]}`}>{badgeLabelByKind[kind]}</i>
      </div>
      <button className="button secondary quotation-result-toggle" type="button" onClick={() => setShowDetails((value) => !value)}>
        {showDetails ? "Ocultar detalhes técnicos" : "Ver detalhes técnicos"}
      </button>
      {showDetails && <pre className="quotation-payload-preview">{json}</pre>}
    </div>
  );
}
