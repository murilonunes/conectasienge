export function FilterBar({ search = "Buscar por nome ou documento" }: { search?: string }) {
  return (
    <div className="card filters">
      <input className="field search-field" placeholder={search} />
      <select className="field" defaultValue=""><option value="">Todos os status</option><option>Em dia</option><option>Pendente</option><option>Em atraso</option></select>
      <input className="field" type="month" />
      <button className="button secondary">Exportar</button>
    </div>
  );
}
