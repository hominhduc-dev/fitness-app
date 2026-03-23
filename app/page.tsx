import { redirect } from "next/navigation"

import { LandingPage } from "@/components/landing/landing-page"
import { getServerAuthState } from "@/lib/auth/server"
import { getRoleLandingPath } from "@/lib/auth/roles"
import { LocaleProvider } from "@/components/providers/locale-provider"
import { getServerLocale, getServerMessages } from "@/lib/i18n/server"

export default async function Home() {
  const [{ profile }, locale, messages] = await Promise.all([getServerAuthState(), getServerLocale(), getServerMessages()])

  if (profile) {
    redirect(getRoleLandingPath(profile.role))
  }

  return (
    <LocaleProvider initialLocale={locale}>
      <LandingPage locale={locale} messages={messages} />
    </LocaleProvider>
  )
}
