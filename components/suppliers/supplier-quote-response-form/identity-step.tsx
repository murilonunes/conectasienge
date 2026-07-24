import { I18nText } from "@/components/i18n/i18n-text";
import type { Dispatch, SetStateAction } from "react";
import { formatDocument } from "./helpers";
import type { RegistrationData } from "./types";

type LockedIdentityFields = {
  document?: boolean;
  supplierName?: boolean;
  email?: boolean;
  phone?: boolean;
};

type IdentityStepProps = {
  document: string;
  supplierName: string;
  email: string;
  phone: string;
  registration: RegistrationData;
  checkingDocument: boolean;
  supplierExists: boolean | undefined;
  showValidation?: boolean;
  lockedFields?: LockedIdentityFields;
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
  showValidation = false,
  lockedFields,
  onDocumentChange,
  onSupplierNameChange,
  onEmailChange,
  onPhoneChange,
  onRegistrationChange
}: IdentityStepProps) {
  const hasLockedIdentity = Boolean(
    lockedFields?.document || lockedFields?.supplierName || lockedFields?.email || lockedFields?.phone
  );
  const documentValid = document.replace(/\D/g, "").length === 11 || document.replace(/\D/g, "").length === 14;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = phoneDigits.length >= 10 && phoneDigits.length <= 15;

  return (
    <section className="card supplier-portal-card supplier-identity-card">
      <div className="supplier-card-head">
        <span><I18nText text={"Passo 1 de 5"} /></span>
        <h2><I18nText text={"Dados do fornecedor"} /></h2>
        <p className="supplier-card-note"><I18nText text={"Confirme os dados de contato que serão usados pela equipe de compras."} /></p>
      </div>
      <div className={`supplier-document-status ${hasLockedIdentity ? "locked" : supplierExists ? "found" : supplierExists === false ? "pending" : ""}`}>
        <strong>{hasLockedIdentity ? <I18nText text={"Fornecedor definido"} /> : checkingDocument ? <I18nText text={"Consultando"} /> : supplierExists ? <I18nText text={"Cadastro localizado"} /> : supplierExists === false ? <I18nText text={"Cadastro pendente"} /> : <I18nText text={"CPF/CNPJ"} />}</strong>
        <span>{hasLockedIdentity ? <I18nText text={"Os dados do convite foram preenchidos pelo comprador e não podem ser alterados neste portal."} /> : checkingDocument ? <I18nText text={"Verificando base local"} /> : supplierExists ? formatDocument(document) : supplierExists === false ? <I18nText text={"Complete os dados cadastrais"} /> : <I18nText text={"Informe o documento"} />}</span>
      </div>
      <div className="supplier-portal-grid supplier-identity-grid">
        <label className={showValidation && !documentValid ? "supplier-field-invalid" : ""}>
          <span><I18nText text={"CPF/CNPJ *"} /></span>
          <input value={document} inputMode="numeric" readOnly={lockedFields?.document} onChange={(event) => onDocumentChange(event.target.value.replace(/\D/g, ""))} placeholder="00000000000000" data-i18n-placeholder={"00000000000000"} />
        </label>
        <label className={showValidation && !supplierName.trim() ? "supplier-field-invalid" : ""}>
          <span><I18nText text={"Razão social ou nome *"} /></span>
          <input value={supplierName} readOnly={lockedFields?.supplierName} onChange={(event) => onSupplierNameChange(event.target.value)} placeholder="Nome do fornecedor" data-i18n-placeholder={"Nome do fornecedor"} />
        </label>
        <label className={showValidation && !emailValid ? "supplier-field-invalid" : ""}>
          <span><I18nText text={"E-mail *"} /></span>
          <input value={email} required type="email" readOnly={lockedFields?.email} onChange={(event) => onEmailChange(event.target.value)} placeholder="financeiro@empresa.com.br" data-i18n-placeholder={"financeiro@empresa.com.br"} />
        </label>
        <label className={showValidation && !phoneValid ? "supplier-field-invalid" : ""}>
          <span><I18nText text={"Telefone *"} /></span>
          <input value={phone} required type="tel" inputMode="tel" readOnly={lockedFields?.phone} onChange={(event) => onPhoneChange(event.target.value)} placeholder="(00) 00000-0000" data-i18n-placeholder={"(00) 00000-0000"} />
        </label>
      </div>
      {supplierExists === false && (
        <div className="supplier-portal-grid supplier-registration-grid">
          <label><span><I18nText text={"Nome fantasia"} /></span><input value={registration.tradeName} onChange={(event) => onRegistrationChange((current) => ({ ...current, tradeName: event.target.value }))} /></label>
          <label><span><I18nText text={"Cidade"} /></span><input value={registration.city} onChange={(event) => onRegistrationChange((current) => ({ ...current, city: event.target.value }))} /></label>
          <label><span><I18nText text={"UF"} /></span><input maxLength={2} value={registration.state} onChange={(event) => onRegistrationChange((current) => ({ ...current, state: event.target.value.toUpperCase() }))} /></label>
        </div>
      )}
    </section>
  );
}
