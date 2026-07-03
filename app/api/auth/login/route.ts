import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sessionCookie = "brasin_session";
const sessionMaxAge = 60 * 60 * 12;
const attempts = new Map<string, { count: number; resetAt: number }>();
const maxAttempts = 8;
const windowMs = 15 * 60 * 1000;

function configuredPassword() {
  return process.env.APP_ACCESS_PASSWORD || "";
}

function passwordReady(password: string) {
  return password.length >= 12;
}

function authSecret() {
  return process.env.APP_AUTH_SECRET || configuredPassword();
}

function sign(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("hex");
}

function equalText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
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

function tooManyAttempts(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt < now) return false;
  return current.count >= maxAttempts;
}

function registerFailedAttempt(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  attempts.set(key, { ...current, count: current.count + 1 });
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
    const response = NextResponse.json(payload, { status });
    return response;
  }
  return NextResponse.redirect(new URL(redirectPath, request.url), 303);
}

async function loginInput(request: NextRequest) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    const json = await request.json().catch(() => ({})) as { password?: string; next?: string };
    return {
      password: String(json.password || ""),
      next: safeNext(json.next || null)
    };
  }
  const form = await request.formData();
  return {
    password: String(form.get("password") || ""),
    next: safeNext(form.get("next"))
  };
}

export async function POST(request: NextRequest) {
  const password = configuredPassword();
  const inputData = await loginInput(request);
  const next = inputData.next;
  const key = clientKey(request);

  if (!passwordReady(password) || !authSecret()) {
    return jsonOrRedirect(request, { ok: false, message: "Senha do sistema não configurada." }, "/login?config=1", 503);
  }

  if (tooManyAttempts(key)) {
    const redirectPath = `/login?bloqueado=1&next=${encodeURIComponent(next)}`;
    return jsonOrRedirect(request, { ok: false, message: "Muitas tentativas. Aguarde alguns minutos." }, redirectPath, 429);
  }

  if (!equalText(inputData.password, password)) {
    registerFailedAttempt(key);
    const redirectPath = `/login?erro=1&next=${encodeURIComponent(next)}`;
    return jsonOrRedirect(request, { ok: false, message: "Senha inválida." }, redirectPath, 401);
  }

  const expires = String(Math.floor(Date.now() / 1000) + sessionMaxAge);
  const response = wantsJson(request)
    ? NextResponse.json({ ok: true, next })
    : NextResponse.redirect(new URL(next, request.url), 303);
  clearAttempts(key);
  response.cookies.set(sessionCookie, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAge
  });
  return response;
}
