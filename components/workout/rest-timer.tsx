"use client"

import { useState, useEffect } from "react"
import { Play, Pause, RotateCcw, Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface RestTimerProps {
  defaultTime?: number // in seconds
  onComplete?: () => void
}

export function RestTimer({ defaultTime = 90, onComplete }: RestTimerProps) {
  const [timeLeft, setTimeLeft] = useState(defaultTime)
  const [isRunning, setIsRunning] = useState(false)
  const [initialTime, setInitialTime] = useState(defaultTime)

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false)
            onComplete?.()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => clearInterval(interval)
  }, [isRunning, timeLeft, onComplete])

  const toggleTimer = () => setIsRunning(!isRunning)

  const resetTimer = () => {
    setIsRunning(false)
    setTimeLeft(initialTime)
  }

  const adjustTime = (amount: number) => {
    const newTime = Math.max(0, initialTime + amount)
    setInitialTime(newTime)
    if (!isRunning) {
      setTimeLeft(newTime)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const progress = (timeLeft / initialTime) * 100

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">Rest Timer</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => adjustTime(-15)}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => adjustTime(15)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="relative flex items-center justify-center">
        {/* Progress ring */}
        <svg className="h-32 w-32 -rotate-90 transform">
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-muted"
          />
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={`${progress * 3.52} 352`}
            className={cn("transition-all duration-1000", timeLeft <= 10 ? "text-accent" : "text-primary")}
            strokeLinecap="round"
          />
        </svg>

        {/* Time display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-3xl font-bold tabular-nums", timeLeft <= 10 && "text-accent")}>
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <Button variant="outline" size="icon" className="h-10 w-10 bg-transparent" onClick={resetTimer}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          size="lg"
          className={cn(
            "h-12 w-24 gap-2",
            isRunning ? "bg-accent hover:bg-accent/90" : "bg-primary hover:bg-primary/90",
          )}
          onClick={toggleTimer}
        >
          {isRunning ? (
            <>
              <Pause className="h-5 w-5" />
              Pause
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              Start
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
