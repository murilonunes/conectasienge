import { NextResponse } from "next/server";
import { localeCookieName, resolveLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { locale?: string };
  const locale = resolveLocale(body.locale);
  const response = NextResponse.json({ ok: true, locale });
  response.cookies.set(localeCookieName, locale, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
  return response;
}
