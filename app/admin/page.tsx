import { AdminConsole } from "@/components/admin/admin-console"
import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Sidebar } from "@/components/layout/sidebar"
import { requireAppSession } from "@/lib/auth/server"

export default async function AdminPage() {
  await requireAppSession({ role: "admin" })

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="admin" />

      <div className="flex flex-1 flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
            <AdminConsole />
          </div>
        </main>

        <MobileNav role="admin" />
      </div>
    </div>
  )
}
