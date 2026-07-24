"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { useI18n } from "@/components/i18n/i18n-provider";
import { FormEvent, useState } from "react";

export function LoginForm({ next, invalid, blocked }: { next: string; invalid?: boolean; blocked?: boolean }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(blocked ? "Muitas tentativas. Aguarde alguns minutos." : invalid ? "E-mail ou senha inválidos. Tente novamente." : "");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ email, password, next })
      });
      const json = await response.json().catch(() => ({})) as { ok?: boolean; next?: string; message?: string };
      if (!response.ok || !json.ok) {
        setMessage(json.message || "Não foi possível acessar.");
        return;
      }
      window.location.assign(json.next || next || "/");
    } catch {
      setMessage("Falha ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="auth-login-form">
      <label>
        <span><I18nText text={"E-mail"} /></span>
        <input autoFocus value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" placeholder="seu@email.com.br" data-i18n-placeholder={"seu@email.com.br"} />
      </label>
      <label>
        <span><I18nText text={"Senha"} /></span>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
      </label>
      <p className="auth-login-hint"><I18nText text={"Sem e-mail cadastrado? Deixe o e-mail em branco e use a senha mestre do sistema."} /></p>
      {message && <div className="auth-config-warning"><strong><I18nText text={"Acesso"} /></strong><span>{t(message)}</span></div>}
      <button className="button" type="submit" disabled={loading}>
        <I18nText text={loading ? "Entrando..." : "Acessar"} />
      </button>
    </form>
  );
}
