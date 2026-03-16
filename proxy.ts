import { NextResponse, type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/proxy"

const protectedPrefixes = ["/coach", "/dashboard", "/meals", "/profile", "/progress", "/schedule", "/workout"]

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/"
    redirectUrl.searchParams.set("auth", "login")
    redirectUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: ["/coach/:path*", "/dashboard/:path*", "/meals/:path*", "/profile/:path*", "/progress/:path*", "/schedule/:path*", "/workout/:path*"],
}
