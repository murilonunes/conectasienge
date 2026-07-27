"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type CsvValue = string | number | boolean | null | undefined;

type CsvExportConfig<T> = {
  fileName: string;
  buttonLabel?: string;
  columns: Array<{
    header: string;
    value: (item: unknown) => CsvValue;
  }>;
  rows?: (items: T[]) => unknown[];
};

type LocalDataListProps<T> = {
  items: T[];
  itemLabel?: string;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  resetKey?: string;
  emptyMessage?: string;
  csvExport?: CsvExportConfig<T>;
  renderItems: (items: T[]) => ReactNode;
};

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE_OPTIONS = [50, 100, 200, 500];

export function LocalDataList<T>({
  items,
  itemLabel = "registros",
  defaultPageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  resetKey,
  emptyMessage = "Nenhum registro encontrado.",
  csvExport,
  renderItems
}: LocalDataListProps<T>) {
  const normalizedOptions = useMemo(() => {
    const options = new Set([...pageSizeOptions, defaultPageSize].filter((value) => value > 0));
    return Array.from(options).sort((left, right) => left - right);
  }, [defaultPageSize, pageSizeOptions]);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = items.length ? (currentPage - 1) * pageSize : 0;
  const end = Math.min(start + pageSize, items.length);
  const pageItems = items.slice(start, end);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function changePageSize(value: string) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) setPageSize(parsed);
  }

  function csvCell(value: CsvValue) {
    const text = value === undefined || value === null ? "" : String(value);
    return `"${text.replace(/"/g, "\"\"").replace(/\r?\n/g, " ")}"`;
  }

  function exportCsv() {
    if (!csvExport) return;
    const rows: unknown[] = csvExport.rows ? csvExport.rows(items) : items;
    const header = csvExport.columns.map((column) => csvCell(column.header)).join(";");
    const body = rows.map((row) => csvExport.columns.map((column) => csvCell(column.value(row))).join(";"));
    const csv = `\uFEFF${[header, ...body].join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = csvExport.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function controls(position: "top" | "bottom") {
    if (!items.length) return null;
    return (
      <div className={`local-list-controls ${position}`}>
        <div>
          <strong>{items.length}</strong>
          <span><I18nText text={itemLabel} /></span>
          <small><I18nText text={"Exibindo"} /> {start + 1}<I18nText text={"-"} />{end}</small>
        </div>
        <label>
          <I18nText text={"Registros por página"} />
          <select value={pageSize} onChange={(event) => changePageSize(event.target.value)}>
            {normalizedOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        {csvExport && (
          <button className="local-list-export" type="button" onClick={exportCsv}>
            {csvExport.buttonLabel || <I18nText text={"Exportar CSV"} />}
          </button>
        )}
        <div className="local-list-pages">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>
            <I18nText text={"Anterior"} />
          </button>
          <span><I18nText text={"Página"} /> {currentPage} <I18nText text={"de"} /> {totalPages}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage >= totalPages}>
            <I18nText text={"Próxima"} />
          </button>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return <div className="empty-state"><I18nText text={emptyMessage} /></div>;
  }

  return (
    <div className="local-data-list">
      {controls("top")}
      {renderItems(pageItems)}
      {totalPages > 1 && controls("bottom")}
    </div>
  );
}
