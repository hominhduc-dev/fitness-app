import type { ReactNode } from "react"

import { AuthProvider } from "@/components/providers/auth-provider"
import { LocaleProvider } from "@/components/providers/locale-provider"
import { requireAppUser } from "@/lib/auth/server"
import { getServerLocale } from "@/lib/i18n/server"

export default async function WorkoutSessionLayout({ children }: { children: ReactNode }) {
  const [locale] = await Promise.all([getServerLocale(), requireAppUser({ role: "trainee" })])

  return (
    <LocaleProvider initialLocale={locale}>
      <AuthProvider>{children}</AuthProvider>
    </LocaleProvider>
  )
}
