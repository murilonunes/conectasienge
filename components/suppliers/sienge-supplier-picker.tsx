"use client";

import { useEffect, useMemo, useState } from "react";

export type SupplierOption = {
  id: number;
  name: string;
  tradeName?: string;
  document?: string;
  city?: string;
  state?: string;
  active?: boolean;
  source: "creditors" | "payables";
};

type SupplierSearchResponse = {
  suppliers: SupplierOption[];
  total: number;
  warning?: string;
};

type SiengeSupplierPickerProps = {
  value: string;
  onChange: (value: string, supplier?: SupplierOption) => void;
  label?: string;
  required?: boolean;
  compact?: boolean;
};

const initialCreate = {
  name: "",
  tradeName: "",
  type: "JURIDICA",
  cnpj: "",
  cpf: "",
  email: "",
  phone: ""
};

function documentLabel(supplier: SupplierOption) {
  if (!supplier.document) return "Documento não informado";
  return supplier.document.length > 11 ? `CNPJ ${supplier.document}` : `CPF ${supplier.document}`;
}

export function SiengeSupplierPicker({ value, onChange, label = "Fornecedor Sienge", required = false, compact = false }: SiengeSupplierPickerProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createData, setCreateData] = useState(initialCreate);
  const [result, setResult] = useState<SupplierSearchResponse>({ suppliers: [], total: 0 });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  const selected = useMemo(() => result.suppliers.find((supplier) => String(supplier.id) === value), [result.suppliers, value]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: search, limit: compact ? "8" : "12" });
        const response = await fetch(`/api/sienge/suppliers?${params}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const json = await response.json() as SupplierSearchResponse;
        setResult(json);
        setMessage(json.warning || "");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage("Não foi possível buscar fornecedores agora.");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [compact, search]);

  function updateCreate(field: keyof typeof initialCreate, next: string) {
    setCreateData((current) => ({ ...current, [field]: next }));
  }

  async function createSupplier(confirm: boolean) {
    setCreatingSupplier(true);
    setMessage("");
    try {
      const response = await fetch("/api/sienge/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...createData, confirm })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.suggestion || json.apiMessage || json.message || json.title || "Não foi possível criar fornecedor.");
      setMessage(json.message || "Operação preparada.");
      if (confirm) setCreateData(initialCreate);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setCreatingSupplier(false);
    }
  }

  return (
    <div className={`supplier-picker ${compact ? "compact" : ""}`}>
      <label className="supplier-picker-field">
        <span>{label}{required ? " *" : ""}</span>
        <div className="supplier-picker-input-row">
          <input
            required={required}
            value={value}
            onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
            placeholder="ID"
          />
          <button className="button secondary" type="button" onClick={() => setOpen((current) => !current)}>
            Buscar
          </button>
        </div>
        <small>{selected ? selected.name : value ? `Fornecedor #${value}` : "Busque na base local ou informe o ID."}</small>
      </label>

      {open && (
        <section className="supplier-picker-panel">
          <div className="supplier-picker-search">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, CNPJ, CPF ou ID" />
            <button className="button secondary" type="button" onClick={() => setCreating((current) => !current)}>
              {creating ? "Voltar à busca" : "Criar fornecedor"}
            </button>
          </div>

          {!creating && (
            <div className="supplier-picker-results">
              {result.suppliers.map((supplier) => (
                <button
                  key={`${supplier.source}-${supplier.id}`}
                  type="button"
                  className={String(supplier.id) === value ? "active" : ""}
                  onClick={() => { onChange(String(supplier.id), supplier); setOpen(false); }}
                >
                  <span>
                    <strong>{supplier.name}</strong>
                    <small>{documentLabel(supplier)} - #{supplier.id} - {supplier.source === "creditors" ? "Cadastro" : "Financeiro"}</small>
                  </span>
                  <b>Usar</b>
                </button>
              ))}
              {!loading && !result.suppliers.length && <div className="empty-state">Nenhum fornecedor encontrado na base local.</div>}
              {loading && <div className="empty-state">Buscando fornecedores...</div>}
            </div>
          )}

          {creating && (
            <div className="supplier-create-form">
              <label><span>Razão social / Nome</span><input value={createData.name} onChange={(event) => updateCreate("name", event.target.value)} /></label>
              <label><span>Nome fantasia</span><input value={createData.tradeName} onChange={(event) => updateCreate("tradeName", event.target.value)} /></label>
              <label><span>Tipo</span><select value={createData.type} onChange={(event) => updateCreate("type", event.target.value)}><option value="JURIDICA">Pessoa jurídica</option><option value="FISICA">Pessoa física</option></select></label>
              <label><span>CNPJ</span><input value={createData.cnpj} onChange={(event) => updateCreate("cnpj", event.target.value.replace(/\D/g, ""))} /></label>
              <label><span>CPF</span><input value={createData.cpf} onChange={(event) => updateCreate("cpf", event.target.value.replace(/\D/g, ""))} /></label>
              <label><span>E-mail</span><input value={createData.email} onChange={(event) => updateCreate("email", event.target.value)} /></label>
              <label><span>Telefone</span><input value={createData.phone} onChange={(event) => updateCreate("phone", event.target.value)} /></label>
              <div className="supplier-create-actions">
                <button className="button secondary" type="button" disabled={creatingSupplier || !createData.name} onClick={() => createSupplier(false)}>Preparar</button>
                <button className="button" type="button" disabled={creatingSupplier || !createData.name} onClick={() => createSupplier(true)}>{creatingSupplier ? "Enviando..." : "Criar no Sienge"}</button>
              </div>
            </div>
          )}

          {message && <div className="settings-inline-message">{message}</div>}
        </section>
      )}
    </div>
  );
}
