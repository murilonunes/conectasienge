import { NextRequest, NextResponse } from "next/server";

const sessionCookie = "brasin_session";

function authSecret() {
  return process.env.APP_AUTH_SECRET || process.env.APP_ACCESS_PASSWORD || "";
}

function publicPath(pathname: string) {
  return pathname.startsWith("/_next")
    || pathname === "/favicon.ico"
    || pathname === "/robots.txt"
    || pathname === "/manifest.webmanifest"
    || pathname === "/login"
    || pathname === "/api/auth/login"
    || pathname === "/api/auth/logout"
    || pathname.startsWith("/portal-cotacao")
    || pathname === "/api/supplier-portal/responses"
    || pathname === "/api/supplier-portal/suppliers";
}

async function hmac(value: string) {
  const secret = authSecret();
  if (!secret) return "";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualStr(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

async function validSession(raw?: string) {
  if (!raw || !authSecret()) return false;
  const [expires, signature] = raw.split(".");
  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;
  return timingSafeEqualStr(signature || "", await hmac(expires));
}

function withPathHeader(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-current-path", request.nextUrl.pathname);
  return headers;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const headers = withPathHeader(request);

  if (publicPath(pathname)) {
    return NextResponse.next({ request: { headers } });
  }

  if (await validSession(request.cookies.get(sessionCookie)?.value)) {
    return NextResponse.next({ request: { headers } });
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "Acesso protegido por senha." }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
