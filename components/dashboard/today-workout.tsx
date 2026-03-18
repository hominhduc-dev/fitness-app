"use client"

import Link from "next/link"
import { Clock, Dumbbell, Play } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import type { Workout } from "@/lib/types"

interface TodayWorkoutProps {
  workout: Workout | null
}

export function TodayWorkout({ workout }: TodayWorkoutProps) {
  const { messages } = useLocale()

  if (!workout) {
    return (
      <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
        <h3 className="text-2xl font-black tracking-tight text-foreground">{messages.dashboard.todaysWorkout}</h3>

        <div className="flex min-h-[290px] flex-col items-center justify-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Dumbbell className="h-9 w-9 text-muted-foreground" />
          </div>
          <p className="mt-6 text-3xl font-bold tracking-tight text-foreground">{messages.dashboard.restDay}</p>
          <p className="mt-3 max-w-md text-base text-muted-foreground">{messages.dashboard.restDayCopy}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-2xl font-black tracking-tight text-foreground">{messages.dashboard.todaysWorkout}</h3>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Dumbbell className="h-5 w-5" />
        </div>
      </div>

      <div className="flex min-h-[290px] flex-col justify-between">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Play className="ml-1 h-9 w-9 fill-current" />
          </div>
          <p className="mt-6 text-3xl font-bold tracking-tight text-foreground">{workout.name}</p>
          <p className="mt-3 text-base text-muted-foreground">
            {workout.exercises.length} {messages.dashboard.exercises} · {workout.duration ?? "?"} {messages.dashboard.min}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
            {workout.exercises.slice(0, 3).map((exercise) => (
              <span key={exercise.id} className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {exercise.exercise.name}
              </span>
            ))}
          </div>
        </div>

        <Link href={`/workout/${workout.id}/start`} className="mt-6">
          <Button className="h-12 w-full rounded-2xl text-base font-semibold">
            {messages.dashboard.start}
          </Button>
        </Link>
      </div>
    </div>
  )
}
