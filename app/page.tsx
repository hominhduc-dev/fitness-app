import { LandingPage } from "@/components/landing/landing-page"
import { LocaleProvider } from "@/components/providers/locale-provider"
import { getServerLocale, getServerMessages } from "@/lib/i18n/server"

export default async function Home() {
  const [locale, messages] = await Promise.all([getServerLocale(), getServerMessages()])

  return (
    <LocaleProvider initialLocale={locale}>
      <LandingPage locale={locale} messages={messages} />
    </LocaleProvider>
  )
}
