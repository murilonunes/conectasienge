import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams
}: {
  searchParams?: { erro?: string; config?: string; bloqueado?: string; next?: string };
}) {
  const next = searchParams?.next && searchParams.next.startsWith("/") ? searchParams.next : "/";
  const missingConfig = searchParams?.config === "1" || !process.env.APP_ACCESS_PASSWORD || process.env.APP_ACCESS_PASSWORD.length < 12;
  const invalid = searchParams?.erro === "1";
  const blocked = searchParams?.bloqueado === "1";

  return (
    <section className="auth-public-shell">
      <div className="card auth-login-card">
        <div className="brand auth-brand">
          <div className="brand-mark">B</div>
          <div><strong>Brasin</strong><span>ACESSO PROTEGIDO</span></div>
        </div>
        <div className="auth-login-head">
          <span>Portal interno</span>
          <h1>Entrar</h1>
        </div>
        {missingConfig ? (
          <div className="auth-config-warning">
            <strong>Senha não configurada</strong>
            <span>Defina `APP_ACCESS_PASSWORD` com pelo menos 12 caracteres no `.env` e reinicie o servidor.</span>
          </div>
        ) : (
          <LoginForm next={next} invalid={invalid} blocked={blocked} />
        )}
      </div>
    </section>
  );
}
