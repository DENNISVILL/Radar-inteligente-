import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function safeRedirectPath(value: string | null, origin: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\\\") || /[\\u0000-\\u001f\\u007f]/.test(value)) {
    return "/dashboard";
  }

  try {
    const target = new URL(value, origin);
    if (target.origin !== origin) return "/dashboard";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/dashboard";
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const otpType = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextPath = safeRedirectPath(requestUrl.searchParams.get("next"), requestUrl.origin);
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.redirect(new URL("/login?error=supabase_not_configured", requestUrl.origin));
  }

  let authError: Error | null = null;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    authError = result.error;
  } else if (tokenHash && otpType) {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
    authError = result.error;
  } else {
    authError = new Error("Missing confirmation code or token.");
  }

  if (authError) {
    return NextResponse.redirect(new URL("/login?error=auth_callback", requestUrl.origin));
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
