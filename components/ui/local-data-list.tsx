"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type LocalDataListProps<T> = {
  items: T[];
  itemLabel?: string;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  resetKey?: string;
  emptyMessage?: string;
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

  function controls(position: "top" | "bottom") {
    if (!items.length) return null;
    return (
      <div className={`local-list-controls ${position}`}>
        <div>
          <strong>{items.length}</strong>
          <span>{itemLabel}</span>
          <small>Exibindo {start + 1}-{end}</small>
        </div>
        <label>
          Registros por página
          <select value={pageSize} onChange={(event) => changePageSize(event.target.value)}>
            {normalizedOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <div className="local-list-pages">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>
            Anterior
          </button>
          <span>Página {currentPage} de {totalPages}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage >= totalPages}>
            Próxima
          </button>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="local-data-list">
      {controls("top")}
      {renderItems(pageItems)}
      {totalPages > 1 && controls("bottom")}
    </div>
  );
}
