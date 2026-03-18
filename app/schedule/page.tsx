import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Sidebar } from "@/components/layout/sidebar"
import { WeeklyCalendar } from "@/components/schedule/weekly-calendar"
import { requireAppSession } from "@/lib/auth/server"
import { fetchWorkouts } from "@/lib/fitness/api"

export default async function SchedulePage() {
  const { accessToken } = await requireAppSession({ role: "trainee" })
  const workoutData = await fetchWorkouts(accessToken)

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-background text-foreground">
      <Sidebar role="trainee" />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />

        <main className="flex-1 overflow-x-hidden overflow-y-auto pb-20 md:pb-6">
          <div className="mx-auto w-full max-w-[1320px] px-4 py-6 md:px-8 md:py-8">
            <WeeklyCalendar recentLogs={workoutData.recentLogs} schedule={workoutData.schedule} workouts={workoutData.workouts} />
          </div>
        </main>

        <MobileNav role="trainee" />
      </div>
    </div>
  )
}
