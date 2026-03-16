"use client"

import type React from "react"

import { startTransition, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2, X, AlertCircle, CheckCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  ApiError,
  forgotPasswordRequest,
  loginRequest,
  registerRequest,
} from "@/lib/auth/api"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { getAppBaseUrl } from "@/lib/supabase/config"

interface AuthModalProps {
  defaultTab?: "login" | "register"
  onOpenChange: (open: boolean) => void
  open: boolean
  redirectToPath?: string | null
}

const REMEMBERED_EMAIL_KEY = "yeahbuddy:remembered-email"
const supabase = createBrowserSupabaseClient()

function sanitizeRedirectPath(path?: string | null) {
  if (!path || !path.startsWith("/")) {
    return null
  }

  return path
}

function getRoleLandingPath(role?: string | null) {
  return role === "coach" ? "/coach" : "/dashboard"
}

function createCallbackRedirect(nextPath?: string | null) {
  const redirectUrl = new URL("/auth/callback", getAppBaseUrl())
  const sanitizedPath = sanitizeRedirectPath(nextPath)

  if (sanitizedPath) {
    redirectUrl.searchParams.set("next", sanitizedPath)
  }

  return redirectUrl.toString()
}

export function AuthModal({ open, onOpenChange, defaultTab = "login", redirectToPath }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">(defaultTab)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState<"google" | "apple" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [registerName, setRegisterName] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const isMobile = useIsMobile()
  const router = useRouter()
  const finalRedirectPath = sanitizeRedirectPath(redirectToPath)

  useEffect(() => {
    setActiveTab(defaultTab)
    setError(null)
    setSuccess(null)
  }, [defaultTab])

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY)

    if (!rememberedEmail) {
      return
    }

    startTransition(() => {
      setLoginEmail(rememberedEmail)
      setRememberMe(true)
    })
  }, [])

  async function applyBrowserSession(session?: {
    accessToken: string
    refreshToken: string
  } | null) {
    if (!session) {
      return
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    })

    if (sessionError) {
      throw sessionError
    }
  }

  async function finalizeAuthentication(role?: string | null, session?: { accessToken: string; refreshToken: string } | null) {
    await applyBrowserSession(session)

    if (rememberMe) {
      window.localStorage.setItem(REMEMBERED_EMAIL_KEY, loginEmail.trim())
    } else {
      window.localStorage.removeItem(REMEMBERED_EMAIL_KEY)
    }

    onOpenChange(false)
    router.push(finalRedirectPath ?? getRoleLandingPath(role))
    router.refresh()
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setIsLoading(true)

    try {
      const response = await loginRequest({
        email: loginEmail,
        password: loginPassword,
      })

      if (!response.session) {
        throw new Error("Backend không trả về session đăng nhập.")
      }

      setSuccess("Đăng nhập thành công.")
      await finalizeAuthentication(response.profile?.role, response.session)
    } catch (rawError) {
      const message = rawError instanceof ApiError || rawError instanceof Error ? rawError.message : "Không thể đăng nhập."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (registerPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.")
      return
    }

    if (registerPassword.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.")
      return
    }

    setIsLoading(true)

    try {
      const response = await registerRequest({
        email: registerEmail,
        name: registerName,
        password: registerPassword,
        redirectTo: createCallbackRedirect(finalRedirectPath),
        role: "trainee",
      })

      if (response.requiresEmailConfirmation || !response.session) {
        setSuccess(response.message ?? "Tài khoản đã được tạo. Vui lòng xác nhận email để tiếp tục.")
        setActiveTab("login")
        setLoginEmail(registerEmail.trim())
        setLoginPassword("")
        return
      }

      setSuccess("Tạo tài khoản thành công.")
      await finalizeAuthentication(response.profile?.role, response.session)
    } catch (rawError) {
      const message = rawError instanceof ApiError || rawError instanceof Error ? rawError.message : "Không thể đăng ký."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    setError(null)
    setSuccess(null)

    const targetEmail = loginEmail.trim()

    if (!targetEmail) {
      setError("Nhập email trước khi yêu cầu đặt lại mật khẩu.")
      return
    }

    setIsLoading(true)

    try {
      const response = await forgotPasswordRequest({
        email: targetEmail,
        redirectTo: createCallbackRedirect("/reset-password"),
      })

      setSuccess(response.message ?? "Email đặt lại mật khẩu đã được gửi.")
    } catch (rawError) {
      const message =
        rawError instanceof ApiError || rawError instanceof Error ? rawError.message : "Không thể gửi email đặt lại mật khẩu."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthLogin = async (provider: "google" | "apple") => {
    setError(null)
    setSuccess(null)
    setOauthLoadingProvider(provider)

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      options: {
        redirectTo: createCallbackRedirect(finalRedirectPath),
      },
      provider,
    })

    if (oauthError) {
      setError(oauthError.message)
      setOauthLoadingProvider(null)
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value as "login" | "register")
    setError(null)
    setSuccess(null)
  }

  const renderOAuthButton = (provider: "google" | "apple", label: string, icon: React.ReactNode) => (
    <Button
      variant="outline"
      type="button"
      onClick={() => void handleOAuthLogin(provider)}
      disabled={isLoading || oauthLoadingProvider !== null}
      className="bg-card border-border hover:bg-card/80 h-11 sm:h-10 text-sm"
    >
      {oauthLoadingProvider === provider ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : icon}
      {label}
    </Button>
  )

  const renderAuthContent = () => (
    <>
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 p-3">
          <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-primary">{success}</p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6 bg-card">
          <TabsTrigger
            value="login"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm sm:text-base"
          >
            Đăng nhập
          </TabsTrigger>
          <TabsTrigger
            value="register"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm sm:text-base"
          >
            Đăng ký
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="mt-0">
          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="login-email" className="text-sm">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="email@example.com"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  className="pl-10 bg-card border-border focus:border-primary h-11 sm:h-10 text-base sm:text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="login-password" className="text-sm">
                Mật khẩu
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  className="pl-10 pr-10 bg-card border-border focus:border-primary h-11 sm:h-10 text-base sm:text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox id="remember" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(Boolean(checked))} />
                <Label htmlFor="remember" className="text-xs sm:text-sm font-normal cursor-pointer">
                  Ghi nhớ email
                </Label>
              </div>
              <button
                type="button"
                onClick={() => void handleForgotPassword()}
                className="text-xs sm:text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Quên mật khẩu?
              </button>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12 sm:h-11 text-base sm:text-sm"
              disabled={isLoading || oauthLoadingProvider !== null}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  Đăng nhập
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <div className="relative my-3 sm:my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-2 text-muted-foreground">Hoặc tiếp tục với</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {renderOAuthButton("google", "Google", <GoogleIcon className="mr-2 h-4 w-4" />)}
              {renderOAuthButton("apple", "Apple", <AppleIcon className="mr-2 h-4 w-4" />)}
            </div>
          </form>
        </TabsContent>

        <TabsContent value="register" className="mt-0">
          <form onSubmit={handleRegister} className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="register-name" className="text-sm">
                Họ và tên
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="register-name"
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={registerName}
                  onChange={(event) => setRegisterName(event.target.value)}
                  className="pl-10 bg-card border-border focus:border-primary h-11 sm:h-10 text-base sm:text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="register-email" className="text-sm">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="register-email"
                  type="email"
                  placeholder="email@example.com"
                  value={registerEmail}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                  className="pl-10 bg-card border-border focus:border-primary h-11 sm:h-10 text-base sm:text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="register-password" className="text-sm">
                Mật khẩu
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="register-password"
                  type={showRegisterPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={registerPassword}
                  onChange={(event) => setRegisterPassword(event.target.value)}
                  className="pl-10 pr-10 bg-card border-border focus:border-primary h-11 sm:h-10 text-base sm:text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowRegisterPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="confirm-password" className="text-sm">
                Xác nhận mật khẩu
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="pl-10 pr-10 bg-card border-border focus:border-primary h-11 sm:h-10 text-base sm:text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={acceptTerms}
                onCheckedChange={(checked) => setAcceptTerms(Boolean(checked))}
                className="mt-0.5"
              />
              <Label htmlFor="terms" className="text-xs sm:text-sm font-normal cursor-pointer leading-relaxed">
                Tôi đồng ý với{" "}
                <button type="button" className="text-primary hover:underline">
                  Điều khoản dịch vụ
                </button>{" "}
                và{" "}
                <button type="button" className="text-primary hover:underline">
                  Chính sách bảo mật
                </button>
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12 sm:h-11 text-base sm:text-sm"
              disabled={isLoading || oauthLoadingProvider !== null || !acceptTerms}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tạo tài khoản...
                </>
              ) : (
                <>
                  Tạo tài khoản
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <div className="relative my-3 sm:my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-2 text-muted-foreground">Hoặc đăng ký với</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {renderOAuthButton("google", "Google", <GoogleIcon className="mr-2 h-4 w-4" />)}
              {renderOAuthButton("apple", "Apple", <AppleIcon className="mr-2 h-4 w-4" />)}
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-surface border-border max-h-[90vh] flex flex-col">
          <div className="mx-auto w-full max-w-md flex flex-col flex-1 overflow-hidden">
            <div className="relative bg-gradient-to-r from-primary/20 via-primary/10 to-transparent px-4 pt-4 pb-3 shrink-0">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
              <DrawerHeader className="relative p-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/25">
                      <Dumbbell className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <span className="text-lg font-bold tracking-tight">YeahBuddy</span>
                  </div>
                  <DrawerClose asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                      <X className="h-4 w-4" />
                    </Button>
                  </DrawerClose>
                </div>
                <DrawerTitle className="text-lg mt-3 text-left">
                  {activeTab === "login" ? "Chào mừng trở lại!" : "Tạo tài khoản"}
                </DrawerTitle>
                <DrawerDescription className="text-muted-foreground text-sm text-left">
                  {activeTab === "login"
                    ? "Đăng nhập để tiếp tục hành trình fitness"
                    : "Bắt đầu hành trình fitness của bạn"}
                </DrawerDescription>
              </DrawerHeader>
            </div>

            <div className="px-4 pb-8 pt-2 overflow-y-auto flex-1">{renderAuthContent()}</div>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-surface border-border p-0 overflow-hidden">
        <div className="relative bg-gradient-to-r from-primary/20 via-primary/10 to-transparent px-6 pt-6 pb-4">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
          <DialogHeader className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/25">
                <Dumbbell className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold tracking-tight">YeahBuddy</span>
            </div>
            <DialogTitle className="text-xl">
              {activeTab === "login" ? "Chào mừng trở lại!" : "Tạo tài khoản"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {activeTab === "login"
                ? "Đăng nhập để tiếp tục hành trình fitness của bạn"
                : "Bắt đầu hành trình fitness của bạn ngay hôm nay"}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6">{renderAuthContent()}</div>
      </DialogContent>
    </Dialog>
  )
}

function Dumbbell(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14.4 14.4 9.6 9.6" />
      <path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.828-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z" />
      <path d="m21.5 21.5-1.4-1.4" />
      <path d="M3.9 3.9 2.5 2.5" />
      <path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.828 2.829z" />
    </svg>
  )
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

function AppleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
    </svg>
  )
}
