"use client"

import Link from "next/link"
import { Flame } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import type { DailyNutrition } from "@/lib/types"

interface NutritionSummaryProps {
  nutrition: DailyNutrition
}

export function NutritionSummary({ nutrition }: NutritionSummaryProps) {
  const { messages } = useLocale()
  const percentage =
    nutrition.targetCalories > 0 ? Math.min(100, Math.round((nutrition.totalCalories / nutrition.targetCalories) * 100)) : 0
  const remaining = Math.max(0, nutrition.targetCalories - nutrition.totalCalories)

  return (
    <Link href="/meals" className="block h-full">
      <div className="flex h-full flex-col rounded-[30px] border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/20">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-2xl font-black tracking-tight text-foreground">{messages.dashboard.todaysNutrition}</h3>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Flame className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-8 flex flex-1 flex-col justify-between gap-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative h-28 w-28 shrink-0">
              <svg className="h-28 w-28 -rotate-90 transform">
                <circle cx="56" cy="56" r="46" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-muted" />
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${percentage * 2.89} 289`}
                  className="text-primary transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-black tracking-tight text-foreground">{percentage}%</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{messages.dashboard.consumed}</p>
                <p className="text-[2rem] font-black tracking-tight text-foreground">
                  {nutrition.totalCalories}
                  <span className="ml-1 text-xl font-medium text-muted-foreground">kcal</span>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{messages.dashboard.remaining}</p>
                <p className="text-[2rem] font-black tracking-tight text-primary">
                  {remaining}
                  <span className="ml-1 text-xl font-medium text-muted-foreground">kcal</span>
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { key: "breakfast", label: messages.dashboard.breakfast },
              { key: "lunch", label: messages.dashboard.lunch },
              { key: "dinner", label: messages.dashboard.dinner },
              { key: "snack", label: messages.dashboard.snack },
            ].map((mealType) => {
              const meal = nutrition.meals.find((entry) => entry.type === mealType.key)

              return (
                <div key={mealType.key} className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3 text-sm">
                  <span className="text-muted-foreground">{mealType.label}</span>
                  <span className={meal ? "font-semibold text-foreground" : "text-muted-foreground"}>{meal ? meal.calories : "—"}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Link>
  )
}
