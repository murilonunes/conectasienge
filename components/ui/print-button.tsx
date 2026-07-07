"use client";

export function PrintButton({ label = "Imprimir / salvar PDF" }: { label?: string }) {
  return (
    <button className="button" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
