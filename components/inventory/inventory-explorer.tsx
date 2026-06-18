"use client";

import { useMemo, useState } from "react";
import { IntegrationStamp } from "@/components/ui/integration-stamp";
import { LocalDataList } from "@/components/ui/local-data-list";
import type { InventoryAsset, InventoryAssetKind } from "@/features/inventory/types";
import { assetKindLabel, assetLocation, assetSubtitle, assetTitle, assetValue, entryDate, ownershipLabel, situationLabel } from "@/features/inventory/utils";
import { formatCurrency, formatDate } from "@/lib/formatters";

const TYPES: InventoryAssetKind[] = ["unit", "movable", "fixed"];

export function InventoryExplorer({ assets }: { assets: InventoryAsset[] }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [ownership, setOwnership] = useState("");
  const [situation, setSituation] = useState("");
  const situations = useMemo(() => Array.from(new Set(assets.map(situationLabel))).sort(), [assets]);

  const filtered = useMemo(() => assets
    .filter((asset) => {
      const text = [
        asset.id,
        asset.unitId,
        asset.patrimonyId,
        asset.name,
        asset.detail,
        asset.enterpriseId,
        asset.propertyType,
        asset.legalRegistrationNumber,
        asset.realEstateRegistration,
        asset.propertyRegistration,
        asset.landRegistration,
        asset.contractNumber,
        asset.brand,
        asset.model,
        asset.barCode,
        asset.plateId,
        asset.serialNumber,
        asset.costCenter,
        asset.city
      ].filter(Boolean).join(" ").toLowerCase();
      const matchesText = text.includes(search.toLowerCase());
      const matchesType = !type || asset.kind === type;
      const matchesOwnership = !ownership || ownershipLabel(asset) === ownership;
      const matchesSituation = !situation || situationLabel(asset) === situation;
      return matchesText && matchesType && matchesOwnership && matchesSituation;
    }), [assets, search, type, ownership, situation]);

  return (
    <section>
      <div className="card inventory-filters">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar patrimônio, unidade, matrícula, placa ou código" />
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">Todos os tipos</option>
          {TYPES.map((item) => <option value={item} key={item}>{assetKindLabel(item)}</option>)}
        </select>
        <select value={situation} onChange={(event) => setSituation(event.target.value)}>
          <option value="">Todas as situações</option>
          {situations.map((item) => <option value={item} key={item}>{item}</option>)}
        </select>
        <select value={ownership} onChange={(event) => setOwnership(event.target.value)}>
          <option value="">Próprio e terceiros</option>
          <option>Próprio</option>
          <option>Terceiro</option>
        </select>
        <div><strong>{filtered.length}</strong><span>bens</span></div>
      </div>

      <LocalDataList
        items={filtered}
        itemLabel="bens"
        resetKey={`${search}|${type}|${ownership}|${situation}`}
        emptyMessage="Nenhum bem em estoque encontrado."
        renderItems={(pageItems) => (
          <div className="card table-card">
            <table>
              <thead><tr><th>Bem</th><th>Tipo</th><th>Entrada</th><th>Valor</th><th>Propriedade</th><th>Situação</th><th>Localização / identificação</th><th>Integração</th></tr></thead>
              <tbody>
                {pageItems.map((asset) => {
                  const value = assetValue(asset);
                  const date = entryDate(asset);
                  const isWarning = situationLabel(asset) === "Baixado" || ownershipLabel(asset) === "Terceiro";
                  return (
                    <tr key={asset.id}>
                      <td><strong>{assetTitle(asset)}</strong><br /><span className="table-muted">{assetSubtitle(asset)}</span></td>
                      <td>{assetKindLabel(asset.kind)}</td>
                      <td>{date ? formatDate(date) : "Não informada"}</td>
                      <td><strong>{value.value ? formatCurrency(value.value) : "Não informado"}</strong><br /><span className="table-muted">{value.source}</span></td>
                      <td>{ownershipLabel(asset)}</td>
                      <td><span className={`badge ${isWarning ? "pending" : ""}`}>{situationLabel(asset)}</span></td>
                      <td>{assetLocation(asset)}<br /><span className="table-muted">{asset.privateArea ? `${asset.privateArea} m² priv.` : asset.plateId ? `Placa ${asset.plateId}` : asset.barCode ? `Código ${asset.barCode}` : ""}</span></td>
                      <td><IntegrationStamp record={asset} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      />
    </section>
  );
}
