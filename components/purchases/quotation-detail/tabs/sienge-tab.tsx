"use client";

import { useState } from "react";
import { SiengeSupplierPicker } from "@/components/suppliers/sienge-supplier-picker";
import { formatOptionalDate } from "@/lib/formatters";
import { OperationResultPanel, type OperationResultKind } from "../../operation-result-panel";
import { formatDocument } from "../helpers";
import type { GeneratedSupplierLink, SiengeAction } from "../types";

type SiengeFormState = {
  buyerId: string;
  quotationDate: string;
  purchaseRequestId: string;
  purchaseRequestItemNumber: string;
  deliveryRequirementNumber: string;
  supplierId: string;
  directItemBuildingId: string;
  directItemProductId: string;
  directItemQuantity: string;
  directItemUnity: string;
  directItemNeedDate: string;
};

type SiengeTopic = "quotation" | "requestItem" | "supplier" | "directItem";

export function SiengeTab({
  quotationId,
  knownBuyerIds,
  form,
  onFormChange,
  onSupplierChange,
  loadingAction,
  onRunAction,
  onGenerateLink,
  operationResult,
  operationTitle,
  operationKind,
  generatedSupplierLink,
  onCopyLink
}: {
  quotationId: number;
  knownBuyerIds: string[];
  form: SiengeFormState;
  onFormChange: <K extends keyof SiengeFormState>(field: K, value: SiengeFormState[K]) => void;
  onSupplierChange: (id: string, supplier?: { document?: string; name?: string }) => void;
  loadingAction: string | null;
  onRunAction: (action: SiengeAction, confirm: boolean) => void;
  onGenerateLink: () => void;
  operationResult: string;
  operationTitle: string;
  operationKind: OperationResultKind;
  generatedSupplierLink?: GeneratedSupplierLink;
  onCopyLink: (url: string) => void;
}) {
  const [activeTopic, setActiveTopic] = useState<SiengeTopic>("quotation");
  const directItemDisabled = !form.directItemBuildingId || !form.directItemProductId || !form.directItemQuantity || !form.directItemUnity.trim() || loadingAction !== null;
  const requestItemReady = Boolean(form.purchaseRequestId && form.purchaseRequestItemNumber);
  const supplierReady = Boolean(form.supplierId && form.purchaseRequestItemNumber);
  const directItemReady = !directItemDisabled || loadingAction !== null;

  const topics: Array<{ key: SiengeTopic; label: string; title: string; description: string; status: string }> = [
    {
      key: "quotation",
      label: "Cotação",
      title: "Cotação no Sienge",
      description: "Crie ou confira a cotação principal antes de vincular itens e fornecedores.",
      status: form.buyerId.trim() ? "Pronto" : "Informe comprador"
    },
    {
      key: "requestItem",
      label: "Item",
      title: "Item da solicitação",
      description: "Vincule um item de solicitação de compra a esta cotação.",
      status: requestItemReady ? "Pronto" : "Informe solicitação"
    },
    {
      key: "supplier",
      label: "Fornecedor",
      title: "Fornecedor e link",
      description: "Inclua fornecedor no item e gere o link do portal público.",
      status: supplierReady ? "Pronto" : "Escolha fornecedor"
    },
    {
      key: "directItem",
      label: "Insumo direto",
      title: "Insumo direto",
      description: "Use somente quando o item não veio de uma solicitação de compra.",
      status: directItemReady ? "Pronto" : "Opcional"
    }
  ];
  const selectedTopic = topics.find((topic) => topic.key === activeTopic) || topics[0];

  return (
    <section className="quotation-operation-layout">
      <aside className="card panel quotation-operation-side quotation-operation-topic-panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Temas Sienge</h2>
            <span className="panel-note">Escolha uma operação por vez</span>
          </div>
          <i className="badge">ID {quotationId}</i>
        </div>
        <div className="quotation-operation-topic-list">
          {topics.map((topic) => (
            <button
              className={activeTopic === topic.key ? "active" : ""}
              key={topic.key}
              type="button"
              onClick={() => setActiveTopic(topic.key)}
            >
              <span>{topic.label}</span>
              <strong>{topic.title}</strong>
              <small>{topic.status}</small>
            </button>
          ))}
        </div>
        <p className="quotation-sienge-legend"><i /> Botões amarelos gravam direto no Sienge quando confirmados.</p>
      </aside>

      <div className="card panel quotation-operation-main">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">{selectedTopic.title}</h2>
            <span className="panel-note">{selectedTopic.description}</span>
          </div>
          <i className="badge">{selectedTopic.label}</i>
        </div>

        {activeTopic === "quotation" && (
          <article className="quotation-operation-block focused">
            <div className="quotation-operation-grid two">
              <label>
                <span>Comprador Sienge</span>
                <input
                  value={form.buyerId}
                  onChange={(event) => onFormChange("buyerId", event.target.value)}
                  placeholder="Login do usuário no Sienge, ex.: MURILO"
                  list="quotation-known-buyer-ids"
                />
                {knownBuyerIds.length > 0 && (
                  <datalist id="quotation-known-buyer-ids">
                    {knownBuyerIds.map((id) => <option value={id} key={id} />)}
                  </datalist>
                )}
                <small className="table-muted">Use o login do usuário comprador no Sienge.</small>
              </label>
              <label>
                <span>Data da cotação</span>
                <input type="date" value={form.quotationDate} onChange={(event) => onFormChange("quotationDate", event.target.value)} />
              </label>
            </div>
            <div className="quotation-operation-actions">
              <button className="button secondary" type="button" onClick={() => onRunAction("create", false)} disabled={!form.buyerId.trim() || loadingAction !== null}>
                Preparar criação
              </button>
              <button className="button sienge-write" type="button" onClick={() => onRunAction("create", true)} disabled={!form.buyerId.trim() || loadingAction !== null}>
                {loadingAction === "create-confirm" ? "Gravando..." : "Criar cotação"}
              </button>
            </div>
          </article>
        )}

        {activeTopic === "requestItem" && (
          <article className="quotation-operation-block focused">
            <div className="quotation-operation-grid">
              <label>
                <span>Solicitação de compra</span>
                <input value={form.purchaseRequestId} onChange={(event) => onFormChange("purchaseRequestId", event.target.value.replace(/\D/g, ""))} placeholder="ID da solicitação" />
              </label>
              <label>
                <span>Item da solicitação</span>
                <input value={form.purchaseRequestItemNumber} onChange={(event) => onFormChange("purchaseRequestItemNumber", event.target.value.replace(/\D/g, ""))} placeholder="Item" />
              </label>
              <label>
                <span>Entrega</span>
                <input value={form.deliveryRequirementNumber} onChange={(event) => onFormChange("deliveryRequirementNumber", event.target.value.replace(/\D/g, ""))} placeholder="1" />
              </label>
            </div>
            <div className="quotation-operation-actions">
              <button className="button secondary" type="button" onClick={() => onRunAction("attach-items", false)} disabled={!requestItemReady || loadingAction !== null}>
                Preparar item
              </button>
              <button className="button sienge-write" type="button" onClick={() => onRunAction("attach-items", true)} disabled={!requestItemReady || loadingAction !== null}>
                {loadingAction === "attach-items-confirm" ? "Vinculando..." : "Vincular item"}
              </button>
            </div>
          </article>
        )}

        {activeTopic === "supplier" && (
          <article className="quotation-operation-block focused">
            <div className="quotation-operation-grid two">
              <SiengeSupplierPicker
                value={form.supplierId}
                onChange={(next, supplier) => onSupplierChange(next, supplier)}
                compact
              />
              <label>
                <span>Item para fornecedor</span>
                <input value={form.purchaseRequestItemNumber} onChange={(event) => onFormChange("purchaseRequestItemNumber", event.target.value.replace(/\D/g, ""))} placeholder="Item" />
              </label>
            </div>
            <div className="quotation-operation-actions">
              <button className="button secondary" type="button" onClick={() => onRunAction("add-supplier", false)} disabled={!supplierReady || loadingAction !== null}>
                Preparar fornecedor
              </button>
              <button className="button sienge-write" type="button" onClick={() => onRunAction("add-supplier", true)} disabled={!supplierReady || loadingAction !== null}>
                {loadingAction === "add-supplier-confirm" ? "Incluindo..." : "Incluir fornecedor"}
              </button>
              <button className="button secondary" type="button" onClick={onGenerateLink} disabled={loadingAction !== null}>
                {loadingAction === "supplier-link" ? "Gerando..." : "Gerar link"}
              </button>
            </div>
          </article>
        )}

        {activeTopic === "directItem" && (
          <article className="quotation-operation-block focused">
            <div className="quotation-operation-grid">
              <label>
                <span>Obra</span>
                <input value={form.directItemBuildingId} onChange={(event) => onFormChange("directItemBuildingId", event.target.value.replace(/\D/g, ""))} placeholder="Código da obra" />
              </label>
              <label>
                <span>Insumo</span>
                <input value={form.directItemProductId} onChange={(event) => onFormChange("directItemProductId", event.target.value.replace(/\D/g, ""))} placeholder="Código do insumo" />
              </label>
              <label>
                <span>Quantidade</span>
                <input value={form.directItemQuantity} onChange={(event) => onFormChange("directItemQuantity", event.target.value.replace(/[^\d.,]/g, "").replace(",", "."))} placeholder="0" />
              </label>
              <label>
                <span>Unidade</span>
                <input value={form.directItemUnity} onChange={(event) => onFormChange("directItemUnity", event.target.value)} placeholder="Ex.: sc, un, m3" />
              </label>
              <label>
                <span>Data de necessidade</span>
                <input type="date" value={form.directItemNeedDate} onChange={(event) => onFormChange("directItemNeedDate", event.target.value)} />
              </label>
            </div>
            <div className="quotation-operation-actions">
              <button className="button secondary" type="button" onClick={() => onRunAction("add-item", false)} disabled={directItemDisabled}>
                Preparar insumo
              </button>
              <button className="button sienge-write" type="button" onClick={() => onRunAction("add-item", true)} disabled={directItemDisabled}>
                {loadingAction === "add-item-confirm" ? "Criando..." : "Criar insumo direto"}
              </button>
            </div>
          </article>
        )}
      </div>

      <OperationResultPanel title={operationTitle} kind={operationKind} json={operationResult} />
      {generatedSupplierLink && (
        <div className="card panel quotation-operation-result quotation-link-result">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Link do fornecedor</h2>
            </div>
            <i className="badge">Pronto</i>
          </div>
          <div className="quotation-copy-link">
            <input readOnly value={generatedSupplierLink.url} onFocus={(event) => event.currentTarget.select()} />
            <button className="button" type="button" onClick={() => onCopyLink(generatedSupplierLink.url)}>
              Copiar link
            </button>
            <a className="button secondary" href={generatedSupplierLink.url} target="_blank" rel="noreferrer">
              Abrir
            </a>
          </div>
          <div className="quotation-link-meta">
            <span><strong>Fornecedor</strong>{generatedSupplierLink.supplierName || "Não informado"}</span>
            <span><strong>Documento</strong>{generatedSupplierLink.document ? formatDocument(generatedSupplierLink.document) : "Não informado"}</span>
            <span><strong>Validade</strong>{generatedSupplierLink.expiresAt ? formatOptionalDate(generatedSupplierLink.expiresAt) : "7 dias"}</span>
            <span><strong>Status</strong>Copiável</span>
          </div>
        </div>
      )}
    </section>
  );
}
