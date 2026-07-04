import type { Dispatch, SetStateAction } from "react";
import { formatDocument } from "./helpers";
import type { RegistrationData } from "./types";

type IdentityStepProps = {
  document: string;
  supplierName: string;
  email: string;
  phone: string;
  registration: RegistrationData;
  checkingDocument: boolean;
  supplierExists: boolean | undefined;
  onDocumentChange: (value: string) => void;
  onSupplierNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onRegistrationChange: Dispatch<SetStateAction<RegistrationData>>;
};

export function IdentityStep({
  document,
  supplierName,
  email,
  phone,
  registration,
  checkingDocument,
  supplierExists,
  onDocumentChange,
  onSupplierNameChange,
  onEmailChange,
  onPhoneChange,
  onRegistrationChange
}: IdentityStepProps) {
  return (
    <section className="card supplier-portal-card supplier-identity-card">
      <div className="supplier-card-head">
        <span>Passo 1 de 5</span>
        <h2>Identificação</h2>
      </div>
      <div className="supplier-portal-grid supplier-identity-grid">
        <label><span>CPF/CNPJ *</span><input value={document} inputMode="numeric" onChange={(event) => onDocumentChange(event.target.value.replace(/\D/g, ""))} placeholder="00000000000000" /></label>
        <label><span>Razão social / Nome *</span><input value={supplierName} onChange={(event) => onSupplierNameChange(event.target.value)} placeholder="Nome do fornecedor" /></label>
        <label><span>E-mail</span><input value={email} type="email" onChange={(event) => onEmailChange(event.target.value)} placeholder="financeiro@empresa.com.br" /></label>
        <label><span>Telefone</span><input value={phone} onChange={(event) => onPhoneChange(event.target.value)} placeholder="(00) 00000-0000" /></label>
      </div>
      <div className={`supplier-document-status ${supplierExists ? "found" : supplierExists === false ? "pending" : ""}`}>
        <strong>{checkingDocument ? "Consultando" : supplierExists ? "Cadastro localizado" : supplierExists === false ? "Cadastro pendente" : "CPF/CNPJ"}</strong>
        <span>{checkingDocument ? "Verificando base local" : supplierExists ? formatDocument(document) : supplierExists === false ? "Complete os dados cadastrais" : "Informe o documento"}</span>
      </div>
      {supplierExists === false && (
        <div className="supplier-portal-grid supplier-registration-grid">
          <label><span>Nome fantasia</span><input value={registration.tradeName} onChange={(event) => onRegistrationChange((current) => ({ ...current, tradeName: event.target.value }))} /></label>
          <label><span>Cidade</span><input value={registration.city} onChange={(event) => onRegistrationChange((current) => ({ ...current, city: event.target.value }))} /></label>
          <label><span>UF</span><input maxLength={2} value={registration.state} onChange={(event) => onRegistrationChange((current) => ({ ...current, state: event.target.value.toUpperCase() }))} /></label>
        </div>
      )}
    </section>
  );
}
