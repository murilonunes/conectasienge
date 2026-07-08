"use client";

type CsvValue = string | number | boolean | null | undefined;

function csvCell(value: CsvValue) {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, "\"\"").replace(/\r?\n/g, " ")}"`;
}

export function CsvExportButton({
  fileName,
  headers,
  rows,
  label = "Exportar CSV",
  className = "payable-review-button compact"
}: {
  fileName: string;
  headers: string[];
  rows: CsvValue[][];
  label?: string;
  className?: string;
}) {
  function handleExport() {
    const header = headers.map(csvCell).join(";");
    const body = rows.map((row) => row.map(csvCell).join(";"));
    const bom = String.fromCharCode(0xfeff);
    const csv = bom + [header, ...body].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button className={className} type="button" onClick={handleExport}>
      {label}
    </button>
  );
}
