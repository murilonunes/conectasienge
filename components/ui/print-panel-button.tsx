"use client";

export function PrintPanelButton({ label = "Imprimir este painel" }: { label?: string }) {
  function handlePrint() {
    document.documentElement.classList.add("printing-single-panel");
    const cleanup = () => {
      document.documentElement.classList.remove("printing-single-panel");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  return (
    <button className="button secondary" type="button" onClick={handlePrint}>
      {label}
    </button>
  );
}
