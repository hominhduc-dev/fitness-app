"use client"

import { useEffect, useState } from "react"
import { Camera, Loader2, Save, User, Bell, Lock, Palette } from "lucide-react"

import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/components/providers/auth-provider"
import { forgotPasswordRequest } from "@/lib/auth/api"
import { getAppBaseUrl } from "@/lib/supabase/config"

const availableGoals = ["Build Muscle", "Lose Weight", "Increase Strength", "Improve Endurance", "Flexibility"]

export default function ProfilePage() {
  const { isLoading, profile, updateProfile } = useAuth()
  const [name, setName] = useState("")
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])
  const [notifications, setNotifications] = useState(true)
  const [restTimerSound, setRestTimerSound] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSendingReset, setIsSendingReset] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) {
      return
    }

    setName(profile.name)
    setSelectedGoals(profile.fitnessGoals ?? [])
  }, [profile])

  const toggleGoal = (goal: string) => {
    setSelectedGoals((currentGoals) =>
      currentGoals.includes(goal) ? currentGoals.filter((currentGoal) => currentGoal !== goal) : [...currentGoals, goal],
    )
  }

  const handleSave = async () => {
    if (!profile) {
      return
    }

    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      await updateProfile({
        fitnessGoals: selectedGoals,
        name,
      })

      setSuccess("Thông tin hồ sơ đã được cập nhật.")
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : "Không thể cập nhật hồ sơ.")
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!profile?.email) {
      return
    }

    setError(null)
    setSuccess(null)
    setIsSendingReset(true)

    try {
      const redirectUrl = new URL("/auth/callback", getAppBaseUrl())
      redirectUrl.searchParams.set("next", "/reset-password")

      const response = await forgotPasswordRequest({
        email: profile.email,
        redirectTo: redirectUrl.toString(),
      })

      setSuccess(response.message ?? "Email đổi mật khẩu đã được gửi.")
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : "Không thể gửi email đổi mật khẩu.")
    } finally {
      setIsSendingReset(false)
    }
  }

  if (isLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải hồ sơ...
        </div>
      </div>
    )
  }

  const initials = profile.name
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment[0])
    .join("")
    .slice(0, 2)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={profile.role} />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold md:text-3xl">Settings</h1>
              <p className="mt-1 text-muted-foreground">Manage your account and preferences</p>
            </div>

            {error && <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            {success && <div className="mb-4 rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm text-primary">{success}</div>}

            <div className="rounded-xl border border-border bg-card p-6 mb-6">
              <div className="flex items-center gap-2 mb-6">
                <User className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Profile</h2>
              </div>

              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="relative">
                  <Avatar className="h-24 w-24 border-4 border-primary/20">
                    <AvatarImage src={profile.avatar || "/placeholder.svg"} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl">{initials || "YB"}</AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
                    title="Avatar upload chưa được triển khai"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={profile.email} disabled className="cursor-not-allowed opacity-80" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 mb-6">
              <div className="flex items-center gap-2 mb-6">
                <Palette className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Fitness Goals</h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {availableGoals.map((goal) => {
                  const isSelected = selectedGoals.includes(goal)

                  return (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => toggleGoal(goal)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {goal}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 mb-6">
              <div className="flex items-center gap-2 mb-6">
                <Bell className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Notifications</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Push Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive workout reminders</p>
                  </div>
                  <Switch checked={notifications} onCheckedChange={setNotifications} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Rest Timer Sound</p>
                    <p className="text-sm text-muted-foreground">Play sound when rest is over</p>
                  </div>
                  <Switch checked={restTimerSound} onCheckedChange={setRestTimerSound} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 mb-6">
              <div className="flex items-center gap-2 mb-6">
                <Lock className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Security</h2>
              </div>

              <Button variant="outline" className="w-full bg-transparent" onClick={() => void handlePasswordReset()} disabled={isSendingReset}>
                {isSendingReset ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang gửi email...
                  </>
                ) : (
                  "Gửi email đổi mật khẩu"
                )}
              </Button>
            </div>

            <Button className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? "Đang lưu..." : "Save Changes"}
            </Button>
          </div>
        </main>

        <MobileNav role={profile.role} />
      </div>
    </div>
  )
}
