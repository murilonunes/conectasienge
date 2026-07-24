import { I18nText } from "@/components/i18n/i18n-text";
export function FilterBar({ search = "Buscar por nome ou documento" }: { search?: string }) {
  return (
    <div className="card filters">
      <input className="field search-field" placeholder={search} />
      <select className="field" defaultValue=""><option value=""><I18nText text={"Todos os status"} /></option><option><I18nText text={"Em dia"} /></option><option><I18nText text={"Pendente"} /></option><option><I18nText text={"Em atraso"} /></option></select>
      <input className="field" type="month" />
      <button className="button secondary"><I18nText text={"Exportar"} /></button>
    </div>
  );
}
