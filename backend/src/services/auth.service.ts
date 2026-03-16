import { UserRole, type User as AppUser } from "@prisma/client"
import type { Session, User as SupabaseUser } from "@supabase/supabase-js"

import { env } from "../config/env"
import { prisma } from "../lib/prisma"
import { supabaseAdmin, supabasePublic } from "../lib/supabase"

type SerializableSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number | null
  expiresIn: number | null
  tokenType: string
}

type AuthUserPayload = {
  id: string
  email: string | null
}

type AuthResult = {
  message?: string
  profile: ReturnType<typeof serializeProfile> | null
  requiresEmailConfirmation?: boolean
  session: SerializableSession | null
  user: AuthUserPayload | null
}

type SerializedProfile = NonNullable<ReturnType<typeof serializeProfile>>

type AuthenticatedProfileContext = {
  authUser: SupabaseUser
  profile: SerializedProfile
}

class AuthServiceError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "AuthServiceError"
    this.status = status
  }
}

function fallbackNameFromEmail(email?: string | null) {
  if (!email) {
    return "YeahBuddy User"
  }

  return email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || email
}

function normalizeRole(role?: string | null) {
  return role === UserRole.coach ? UserRole.coach : UserRole.trainee
}

function sanitizeText(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function normalizeFitnessGoals(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((goal) => String(goal).trim()).filter(Boolean)
}

function resolveUserName(authUser: SupabaseUser, nameOverride?: string | null) {
  if (sanitizeText(nameOverride)) {
    return sanitizeText(nameOverride) as string
  }

  const metadata = authUser.user_metadata

  return (
    sanitizeText(metadata?.name) ??
    sanitizeText(metadata?.full_name) ??
    sanitizeText(metadata?.display_name) ??
    fallbackNameFromEmail(authUser.email)
  )
}

function resolveUserAvatar(authUser: SupabaseUser, avatarOverride?: string | null) {
  if (sanitizeText(avatarOverride)) {
    return sanitizeText(avatarOverride)
  }

  const metadata = authUser.user_metadata
  return sanitizeText(metadata?.avatar_url) ?? sanitizeText(metadata?.picture)
}

function resolveUserRole(authUser: SupabaseUser, roleOverride?: string | null) {
  const metadataRole =
    typeof authUser.user_metadata?.role === "string" ? authUser.user_metadata.role : undefined

  return normalizeRole(roleOverride ?? metadataRole)
}

function ensureAuthClient() {
  if (!supabasePublic) {
    throw new AuthServiceError("Supabase Auth is not configured on the backend.", 500)
  }

  return supabasePublic
}

function ensureAdminClient() {
  if (!supabaseAdmin) {
    throw new AuthServiceError("Supabase admin client is not configured.", 500)
  }

  return supabaseAdmin
}

function serializeSession(session: Session | null): SerializableSession | null {
  if (!session) {
    return null
  }

  return {
    accessToken: session.access_token,
    expiresAt: session.expires_at ?? null,
    expiresIn: session.expires_in ?? null,
    refreshToken: session.refresh_token,
    tokenType: session.token_type,
  }
}

function serializeAuthUser(user: SupabaseUser | null): AuthUserPayload | null {
  if (!user) {
    return null
  }

  return {
    email: user.email ?? null,
    id: user.id,
  }
}

function serializeProfile(profile: AppUser | null) {
  if (!profile) {
    return null
  }

  return {
    avatar: profile.avatar,
    coachId: profile.coachId,
    createdAt: profile.createdAt,
    email: profile.email,
    fitnessGoals: profile.fitnessGoals,
    id: profile.id,
    name: profile.name,
    role: profile.role,
    supabaseAuthUserId: profile.supabaseAuthUserId,
    updatedAt: profile.updatedAt,
  }
}

async function syncProfile(authUser: SupabaseUser, overrides?: { avatar?: string | null; name?: string | null; role?: string | null }) {
  if (!prisma || !authUser.email) {
    return null
  }

  const existingProfile = await prisma.user.findFirst({
    where: {
      OR: [{ supabaseAuthUserId: authUser.id }, { email: authUser.email }],
    },
  })

  const name = resolveUserName(authUser, overrides?.name)
  const avatar = resolveUserAvatar(authUser, overrides?.avatar)
  const metadataGoals = normalizeFitnessGoals(authUser.user_metadata?.fitnessGoals)
  const nextRole = existingProfile?.role ?? resolveUserRole(authUser, overrides?.role)

  if (existingProfile) {
    return prisma.user.update({
      data: {
        avatar: avatar ?? existingProfile.avatar,
        email: authUser.email,
        fitnessGoals: existingProfile.fitnessGoals.length > 0 ? existingProfile.fitnessGoals : metadataGoals,
        name,
        role: nextRole,
        supabaseAuthUserId: authUser.id,
      },
      where: {
        id: existingProfile.id,
      },
    })
  }

  return prisma.user.create({
    data: {
      avatar,
      email: authUser.email,
      fitnessGoals: metadataGoals,
      name,
      role: nextRole,
      supabaseAuthUserId: authUser.id,
    },
  })
}

async function getVerifiedUser(accessToken: string) {
  const client = supabaseAdmin ?? ensureAuthClient()
  const { data, error } = await client.auth.getUser(accessToken)

  if (error || !data.user) {
    throw new AuthServiceError("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.", 401)
  }

  return data.user
}

async function registerUser(input: {
  email: string
  name: string
  password: string
  redirectTo?: string
  role?: string | null
}) {
  const client = ensureAuthClient()
  const email = input.email.trim().toLowerCase()
  const password = input.password.trim()
  const name = input.name.trim()

  if (!email || !password || !name) {
    throw new AuthServiceError("Vui lòng điền đầy đủ họ tên, email và mật khẩu.")
  }

  if (password.length < 6) {
    throw new AuthServiceError("Mật khẩu phải có ít nhất 6 ký tự.")
  }

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role: normalizeRole(input.role),
      },
      emailRedirectTo: input.redirectTo ?? `${env.frontendUrl}/auth/callback`,
    },
  })

  if (error) {
    throw new AuthServiceError(error.message, 400)
  }

  const profile = data.user ? await syncProfile(data.user, { name, role: input.role }) : null
  const requiresEmailConfirmation = !data.session

  return {
    message: requiresEmailConfirmation
      ? "Tài khoản đã được tạo. Vui lòng xác nhận email để hoàn tất đăng nhập."
      : "Đăng ký thành công.",
    profile: serializeProfile(profile),
    requiresEmailConfirmation,
    session: serializeSession(data.session),
    user: serializeAuthUser(data.user),
  } satisfies AuthResult
}

async function loginUser(input: { email: string; password: string }) {
  const client = ensureAuthClient()

  const { data, error } = await client.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  })

  if (error || !data.user) {
    throw new AuthServiceError(error?.message ?? "Không thể đăng nhập.", 401)
  }

  const profile = await syncProfile(data.user)

  return {
    message: "Đăng nhập thành công.",
    profile: serializeProfile(profile),
    session: serializeSession(data.session),
    user: serializeAuthUser(data.user),
  } satisfies AuthResult
}

async function refreshAuthSession(input: { accessToken?: string; refreshToken: string }) {
  const client = ensureAuthClient()

  const { data, error } = await client.auth.refreshSession({
    refresh_token: input.refreshToken,
  })

  if (error || !data.user) {
    throw new AuthServiceError(error?.message ?? "Không thể làm mới phiên đăng nhập.", 401)
  }

  const profile = await syncProfile(data.user)

  return {
    message: "Phiên đăng nhập đã được làm mới.",
    profile: serializeProfile(profile),
    session: serializeSession(data.session),
    user: serializeAuthUser(data.user),
  } satisfies AuthResult
}

async function getCurrentProfile(accessToken: string) {
  const user = await getVerifiedUser(accessToken)
  const profile = await syncProfile(user)

  return {
    profile: serializeProfile(profile),
    session: null,
    user: serializeAuthUser(user),
  } satisfies AuthResult
}

async function requireCurrentProfile(accessToken: string): Promise<AuthenticatedProfileContext> {
  const authUser = await getVerifiedUser(accessToken)
  const profile = await syncProfile(authUser)

  if (!profile) {
    throw new AuthServiceError("Không tìm thấy hồ sơ người dùng.", 404)
  }

  return {
    authUser,
    profile: serializeProfile(profile) as SerializedProfile,
  }
}

async function updateCurrentProfile(
  accessToken: string,
  updates: {
    avatar?: string | null
    fitnessGoals?: string[]
    name?: string | null
  },
) {
  const authUser = await getVerifiedUser(accessToken)

  if (!prisma || !authUser.email) {
    throw new AuthServiceError("Database is not configured for profile updates.", 500)
  }

  const profile = await syncProfile(authUser)

  if (!profile) {
    throw new AuthServiceError("Không tìm thấy hồ sơ người dùng.", 404)
  }

  const nextName = sanitizeText(updates.name) ?? profile.name
  const nextAvatar = updates.avatar === "" ? null : sanitizeText(updates.avatar) ?? profile.avatar
  const nextGoals = Array.isArray(updates.fitnessGoals)
    ? updates.fitnessGoals.map((goal) => goal.trim()).filter(Boolean)
    : profile.fitnessGoals

  const updatedProfile = await prisma.user.update({
    data: {
      avatar: nextAvatar,
      fitnessGoals: nextGoals,
      name: nextName,
    },
    where: {
      id: profile.id,
    },
  })

  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      user_metadata: {
        ...authUser.user_metadata,
        avatar_url: nextAvatar ?? undefined,
        fitnessGoals: nextGoals,
        full_name: nextName,
        name: nextName,
      },
    })

    if (error) {
      throw new AuthServiceError(error.message, 400)
    }
  }

  return {
    message: "Hồ sơ đã được cập nhật.",
    profile: serializeProfile(updatedProfile),
    session: null,
    user: serializeAuthUser(authUser),
  } satisfies AuthResult
}

async function requestPasswordReset(input: { email: string; redirectTo?: string }) {
  const client = ensureAuthClient()

  const { error } = await client.auth.resetPasswordForEmail(input.email.trim().toLowerCase(), {
    redirectTo: input.redirectTo ?? `${env.frontendUrl}/auth/callback?next=/reset-password`,
  })

  if (error) {
    throw new AuthServiceError(error.message, 400)
  }

  return {
    message: "Email đặt lại mật khẩu đã được gửi nếu tài khoản tồn tại.",
    profile: null,
    session: null,
    user: null,
  } satisfies AuthResult
}

async function logoutCurrentSession(accessToken: string) {
  const client = ensureAdminClient()
  const { error } = await client.auth.admin.signOut(accessToken, "global")

  if (error) {
    throw new AuthServiceError(error.message, 400)
  }

  return {
    message: "Đăng xuất thành công.",
    profile: null,
    session: null,
    user: null,
  } satisfies AuthResult
}

export {
  AuthServiceError,
  getCurrentProfile,
  loginUser,
  logoutCurrentSession,
  refreshAuthSession,
  registerUser,
  requireCurrentProfile,
  requestPasswordReset,
  type AuthenticatedProfileContext,
  type SerializedProfile,
  updateCurrentProfile,
}
