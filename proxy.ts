import { NextResponse, type NextRequest } from "next/server"

import { getRoleLandingPath } from "@/lib/auth/roles"
import { updateSession } from "@/lib/supabase/proxy"

const protectedPrefixes = ["/coach", "/dashboard", "/meals", "/profile", "/progress", "/schedule", "/workout"]

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  if (user && pathname === "/") {
    const role = user.user_metadata?.role

    if (!role) {
      return response
    }

    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = getRoleLandingPath(role)
    redirectUrl.search = ""
    return NextResponse.redirect(redirectUrl)
  }

  if (!user && isProtectedPath(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/"
    redirectUrl.searchParams.set("auth", "login")
    redirectUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: ["/", "/coach/:path*", "/dashboard/:path*", "/meals/:path*", "/profile/:path*", "/progress/:path*", "/schedule/:path*", "/workout/:path*"],
}
