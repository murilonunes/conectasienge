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
  const directItemDisabled = !form.directItemBuildingId || !form.directItemProductId || !form.directItemQuantity || !form.directItemUnity.trim() || loadingAction !== null;

  return (
    <section className="quotation-operation-layout">
      <div className="card panel quotation-operation-main">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Operação Sienge</h2>
            <span className="panel-note">Ações diretas separadas por tipo de gravação</span>
          </div>
          <i className="badge">ID {quotationId}</i>
        </div>

        <div className="quotation-operation-sections">
          <article className="quotation-operation-block">
            <div className="quotation-operation-block-head">
              <span>Etapa 1</span>
              <h3>Cotação no Sienge</h3>
            </div>
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

          <article className="quotation-operation-block">
            <div className="quotation-operation-block-head">
              <span>Etapa 2</span>
              <h3>Item da solicitação</h3>
            </div>
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
              <button className="button secondary" type="button" onClick={() => onRunAction("attach-items", false)} disabled={!form.purchaseRequestId || !form.purchaseRequestItemNumber || loadingAction !== null}>
                Preparar item
              </button>
              <button className="button sienge-write" type="button" onClick={() => onRunAction("attach-items", true)} disabled={!form.purchaseRequestId || !form.purchaseRequestItemNumber || loadingAction !== null}>
                {loadingAction === "attach-items-confirm" ? "Vinculando..." : "Vincular item"}
              </button>
            </div>
          </article>

          <article className="quotation-operation-block">
            <div className="quotation-operation-block-head">
              <span>Etapa 3</span>
              <h3>Fornecedor e link</h3>
            </div>
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
              <button className="button secondary" type="button" onClick={() => onRunAction("add-supplier", false)} disabled={!form.supplierId || !form.purchaseRequestItemNumber || loadingAction !== null}>
                Preparar fornecedor
              </button>
              <button className="button sienge-write" type="button" onClick={() => onRunAction("add-supplier", true)} disabled={!form.supplierId || !form.purchaseRequestItemNumber || loadingAction !== null}>
                {loadingAction === "add-supplier-confirm" ? "Incluindo..." : "Incluir fornecedor"}
              </button>
              <button className="button secondary" type="button" onClick={onGenerateLink} disabled={loadingAction !== null}>
                {loadingAction === "supplier-link" ? "Gerando..." : "Gerar link"}
              </button>
            </div>
          </article>

          <article className="quotation-operation-block">
            <div className="quotation-operation-block-head">
              <span>Opcional</span>
              <h3>Insumo direto</h3>
            </div>
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
        </div>
      </div>

      <aside className="card panel quotation-operation-side">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Operações disponíveis</h2>
            <span className="panel-note">O que esta tela grava no Sienge</span>
          </div>
        </div>
        <div className="quotation-endpoint-list">
          <span><strong>Criar</strong>Cotação de preço</span>
          <span><strong>Vincular</strong>Item da solicitação de compra</span>
          <span><strong>Criar</strong>Insumo direto na cotação</span>
          <span><strong>Incluir</strong>Fornecedor no item da cotação</span>
          <span><strong>Gravar</strong>Negociação com valores da proposta</span>
          <span><strong>Autorizar</strong>Negociação do fornecedor vencedor</span>
          <span><strong>Gerar</strong>Link do portal do fornecedor</span>
        </div>
        <p className="quotation-sienge-legend"><i /> Botões nesta cor gravam direto no Sienge em produção assim que confirmados; os brancos apenas preparam o payload ou consultam dados, sem gravar nada.</p>
        <div className="advanced-search-hint warn">
          O fornecedor entra no Sienge por item da cotação. As propostas recebidas pelo link protegido podem ser gravadas como negociação na aba Respostas, e a decisão é registrada e autorizada pela aba Aprovação.
        </div>
      </aside>

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
