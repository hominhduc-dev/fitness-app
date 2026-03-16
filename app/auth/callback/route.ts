import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { getSupabasePublicConfig } from "@/lib/supabase/config"

function sanitizeNextPath(nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/dashboard"
  }

  return nextPath
}

export async function GET(request: NextRequest) {
  const { publishableKey, url } = getSupabasePublicConfig()
  const code = request.nextUrl.searchParams.get("code")
  const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get("next"))
  const redirectUrl = new URL(nextPath, request.url)
  let response = NextResponse.redirect(redirectUrl)

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        response = NextResponse.redirect(redirectUrl)

        cookiesToSet.forEach(({ name, options, value }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  if (!code) {
    const loginUrl = new URL("/", request.url)
    loginUrl.searchParams.set("auth", "login")
    loginUrl.searchParams.set("error", "missing_code")
    return NextResponse.redirect(loginUrl)
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const loginUrl = new URL("/", request.url)
    loginUrl.searchParams.set("auth", "login")
    loginUrl.searchParams.set("error", "auth_callback_failed")
    return NextResponse.redirect(loginUrl)
  }

  return response
}
