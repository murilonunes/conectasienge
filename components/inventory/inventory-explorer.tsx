"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { useMemo, useState } from "react";
import { LocalDataList } from "@/components/ui/local-data-list";
import type { InventoryAsset, InventoryAssetKind } from "@/features/inventory/types";
import { assetKindLabel, assetLocation, assetSubtitle, assetTitle, assetValue, entryDate, ownershipLabel, situationLabel } from "@/features/inventory/utils";
import { formatCurrency, formatDate } from "@/lib/formatters";

const TYPES: InventoryAssetKind[] = ["unit", "movable", "fixed"];

function isSoldOrOut(asset: InventoryAsset) {
  return asset.kind === "unit" && ["V", "G", "T", "L"].includes(asset.commercialStock || "");
}

export function InventoryExplorer({ assets, initialScope = "portfolio" }: { assets: InventoryAsset[]; initialScope?: "portfolio" | "all" }) {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState(initialScope);
  const [type, setType] = useState("");
  const [ownership, setOwnership] = useState("");
  const [situation, setSituation] = useState("");
  const [valueStatus, setValueStatus] = useState("");
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
      const matchesScope = scope === "all" || !isSoldOrOut(asset);
      const matchesType = !type || asset.kind === type;
      const matchesOwnership = !ownership || ownershipLabel(asset) === ownership;
      const matchesSituation = !situation || situationLabel(asset) === situation;
      const value = assetValue(asset).value;
      const matchesValue = !valueStatus || (valueStatus === "priced" ? value > 0 : value <= 0);
      return matchesText && matchesScope && matchesType && matchesOwnership && matchesSituation && matchesValue;
    }), [assets, search, scope, type, ownership, situation, valueStatus]);

  return (
    <section>
      <div className="card inventory-filters">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar patrimônio, unidade, matrícula, placa ou código" data-i18n-placeholder={"Buscar patrimônio, unidade, matrícula, placa ou código"} />
        <select value={scope} onChange={(event) => setScope(event.target.value as "portfolio" | "all")}>
          <option value="portfolio"><I18nText text={"Carteira comercial"} /></option>
          <option value="all"><I18nText text={"Histórico completo"} /></option>
        </select>
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value=""><I18nText text={"Todos os tipos"} /></option>
          {TYPES.map((item) => <option value={item} key={item}>{assetKindLabel(item)}</option>)}
        </select>
        <select value={situation} onChange={(event) => setSituation(event.target.value)}>
          <option value=""><I18nText text={"Todas as situações"} /></option>
          {situations.map((item) => <option value={item} key={item}>{item}</option>)}
        </select>
        <select value={ownership} onChange={(event) => setOwnership(event.target.value)}>
          <option value=""><I18nText text={"Próprio e terceiros"} /></option>
          <option><I18nText text={"Próprio"} /></option>
          <option><I18nText text={"Terceiro"} /></option>
        </select>
        <select value={valueStatus} onChange={(event) => setValueStatus(event.target.value)}>
          <option value=""><I18nText text={"Com e sem valor"} /></option>
          <option value="priced"><I18nText text={"Com valor informado"} /></option>
          <option value="missing"><I18nText text={"Sem valor informado"} /></option>
        </select>
        <div><strong>{filtered.length}</strong><span><I18nText text={"bens"} /></span></div>
      </div>

      <LocalDataList
        items={filtered}
        itemLabel="bens"
        resetKey={`${search}|${scope}|${type}|${ownership}|${situation}|${valueStatus}`}
        emptyMessage="Nenhum bem em estoque encontrado."
        renderItems={(pageItems) => (
          <div className="card table-card">
            <table>
              <thead><tr><th><I18nText text={"Bem"} /></th><th><I18nText text={"Tipo"} /></th><th><I18nText text={"Valor"} /></th><th><I18nText text={"Propriedade"} /></th><th><I18nText text={"Situação"} /></th><th><I18nText text={"Localização / identificação"} /></th><th><I18nText text={"Data de entrada no estoque"} /></th></tr></thead>
              <tbody>
                {pageItems.map((asset) => {
                  const value = assetValue(asset);
                  const date = entryDate(asset);
                  const isWarning = situationLabel(asset) === "Baixado" || ownershipLabel(asset) === "Terceiro";
                  return (
                    <tr key={asset.id}>
                      <td><strong>{assetTitle(asset)}</strong><br /><span className="table-muted">{assetSubtitle(asset)}</span></td>
                      <td>{assetKindLabel(asset.kind)}</td>
                      <td><strong>{value.value ? formatCurrency(value.value) : <I18nText text={"Não informado"} />}</strong><br /><span className="table-muted">{value.source}</span></td>
                      <td>{ownershipLabel(asset)}</td>
                      <td><span className={`badge ${isWarning ? "pending" : ""}`}>{situationLabel(asset)}</span></td>
                      <td>{assetLocation(asset)}<br /><span className="table-muted">{asset.privateArea ? `${asset.privateArea} m² priv.` : asset.plateId ? `Placa ${asset.plateId}` : asset.barCode ? `Código ${asset.barCode}` : <I18nText text={""} />}</span></td>
                      <td>{date ? formatDate(date) : <I18nText text={"Não informada"} />}</td>
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
