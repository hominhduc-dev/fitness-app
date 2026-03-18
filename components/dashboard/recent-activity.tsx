"use client"

import { formatDistanceToNow } from "date-fns"
import { enUS, vi } from "date-fns/locale"
import { CheckCircle2, Clock, Dumbbell } from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import type { WorkoutLog } from "@/lib/types"

interface RecentActivityProps {
  logs: WorkoutLog[]
}

export function RecentActivity({ logs }: RecentActivityProps) {
  const { locale, messages } = useLocale()
  const { profile } = useAuth()
  const weightUnitLabel = profile?.preferredWeightUnit === "lbs" ? "lbs" : "kg"

  return (
    <section className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
      <h3 className="text-2xl font-black tracking-tight text-foreground">{messages.dashboard.recentActivity}</h3>

      <div className="mt-6 space-y-4">
        {logs.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">{messages.dashboard.noRecentWorkouts}</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-4 rounded-[24px] bg-muted p-4 sm:items-center sm:p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-2xl font-bold tracking-tight text-foreground">{log.workout.name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {Math.max(1, Math.round(((log.completedAt?.getTime() || log.startedAt.getTime()) - log.startedAt.getTime()) / 60000))} {messages.dashboard.min}
                      </span>
                      <span className="flex items-center gap-1">
                        <Dumbbell className="h-3.5 w-3.5" />
                        {log.exercises.length} {messages.dashboard.exercises}
                      </span>
                      {log.totalVolume ? <span>{log.totalVolume.toLocaleString()} {weightUnitLabel}</span> : null}
                    </div>
                  </div>

                  <span className="shrink-0 text-sm text-muted-foreground">
                    {formatDistanceToNow(log.completedAt || log.startedAt, {
                      addSuffix: true,
                      locale: locale === "vi" ? vi : enUS,
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
