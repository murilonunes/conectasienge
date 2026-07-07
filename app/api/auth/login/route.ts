import { NextRequest, NextResponse } from "next/server";
import { authenticateLegacyMaster, authenticateUser, createSessionValue, sessionMaxAge } from "@/lib/app-users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sessionCookie = "brasin_session";
const attempts = new Map<string, { count: number; resetAt: number }>();
const maxAttempts = 8;
const windowMs = 15 * 60 * 1000;
// Teto global independente do IP: o cabeçalho x-forwarded-for pode ser
// falsificado quando não há proxy confiável na frente, então um limite
// só por chave não impede força bruta com IPs forjados.
const globalKey = "__global__";
const maxGlobalAttempts = 40;

function authSecretReady() {
  const secret = process.env.APP_AUTH_SECRET || process.env.APP_ACCESS_PASSWORD || "";
  return secret.length >= 12;
}

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) return "/";
  return next;
}

function clientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "local";
}

function bucketFull(key: string, max: number) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt < now) return false;
  return current.count >= max;
}

function tooManyAttempts(key: string) {
  return bucketFull(key, maxAttempts) || bucketFull(globalKey, maxGlobalAttempts);
}

function countFailure(key: string) {
  const now = Date.now();
  if (attempts.size > 1000) {
    attempts.forEach((bucket, staleKey) => {
      if (bucket.resetAt < now) attempts.delete(staleKey);
    });
  }
  const current = attempts.get(key);
  if (!current || current.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  attempts.set(key, { ...current, count: current.count + 1 });
}

function registerFailedAttempt(key: string) {
  countFailure(key);
  countFailure(globalKey);
}

function clearAttempts(key: string) {
  attempts.delete(key);
}

function wantsJson(request: NextRequest) {
  return request.headers.get("accept")?.includes("application/json")
    || request.headers.get("content-type")?.includes("application/json");
}

function jsonOrRedirect(request: NextRequest, payload: { ok: boolean; message?: string; next?: string }, redirectPath: string, status = 200) {
  if (wantsJson(request)) {
    return NextResponse.json(payload, { status });
  }
  return NextResponse.redirect(new URL(redirectPath, request.url), 303);
}

async function loginInput(request: NextRequest) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    const json = await request.json().catch(() => ({})) as { email?: string; password?: string; next?: string };
    return {
      email: String(json.email || "").trim().toLowerCase(),
      password: String(json.password || ""),
      next: safeNext(json.next || null)
    };
  }
  const form = await request.formData();
  return {
    email: String(form.get("email") || "").trim().toLowerCase(),
    password: String(form.get("password") || ""),
    next: safeNext(form.get("next"))
  };
}

export async function POST(request: NextRequest) {
  const inputData = await loginInput(request);
  const next = inputData.next;
  const key = clientKey(request);

  if (!authSecretReady()) {
    return jsonOrRedirect(request, { ok: false, message: "Senha do sistema não configurada." }, "/login?config=1", 503);
  }

  if (tooManyAttempts(key)) {
    const redirectPath = `/login?bloqueado=1&next=${encodeURIComponent(next)}`;
    return jsonOrRedirect(request, { ok: false, message: "Muitas tentativas. Aguarde alguns minutos." }, redirectPath, 429);
  }

  // Com e-mail preenchido autentica pelo cadastro de usuários; sem e-mail vale a
  // senha mestre antiga, que entra como o administrador (migração suave).
  const user = inputData.email
    ? authenticateUser(inputData.email, inputData.password)
    : authenticateLegacyMaster(inputData.password);

  if (!user) {
    registerFailedAttempt(key);
    const redirectPath = `/login?erro=1&next=${encodeURIComponent(next)}`;
    return jsonOrRedirect(request, { ok: false, message: "E-mail ou senha inválidos." }, redirectPath, 401);
  }

  const response = wantsJson(request)
    ? NextResponse.json({ ok: true, next, user: { name: user.name, roles: user.roles } })
    : NextResponse.redirect(new URL(next, request.url), 303);
  clearAttempts(key);
  response.cookies.set(sessionCookie, createSessionValue(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAge()
  });
  return response;
}
