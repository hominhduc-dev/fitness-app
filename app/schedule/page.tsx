import { Copy, Plus } from "lucide-react"

import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Sidebar } from "@/components/layout/sidebar"
import { WeeklyCalendar } from "@/components/schedule/weekly-calendar"
import { Button } from "@/components/ui/button"
import { requireAppSession } from "@/lib/auth/server"
import { fetchWorkouts } from "@/lib/fitness/api"

export default async function SchedulePage() {
  const { accessToken } = await requireAppSession({ role: "trainee" })
  const workoutData = await fetchWorkouts(accessToken)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="trainee" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold md:text-3xl">Weekly Schedule</h1>
                <p className="mt-1 text-muted-foreground">Your current workout plan from assigned programs</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2 bg-transparent" disabled>
                  <Copy className="h-4 w-4" />
                  Copy Week
                </Button>
                <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" disabled>
                  <Plus className="h-4 w-4" />
                  New Workout
                </Button>
              </div>
            </div>

            <WeeklyCalendar schedule={workoutData.schedule} />

            <div className="mt-8">
              <h2 className="mb-4 text-lg font-semibold">Your Workout Templates</h2>
              {workoutData.workouts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <p className="text-muted-foreground">No workout templates available yet.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {workoutData.workouts.map((workout) => (
                    <div
                      key={workout.id}
                      className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30"
                    >
                      <div>
                        <h3 className="font-semibold">{workout.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {workout.exercises.length} exercises · {workout.duration ?? "?"} min
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {[...new Set(workout.exercises.map((exercise) => exercise.exercise.muscleGroup))].map((group) => (
                          <span key={group} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {group}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        <MobileNav role="trainee" />
      </div>
    </div>
  )
}
