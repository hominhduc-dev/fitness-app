import {
  CoachRequestStatus,
  Prisma,
  PrismaClient,
  UserRole,
  type AdminAuditLog,
  type Exercise,
  type Program,
  type User,
} from "@prisma/client"

import { prisma } from "../lib/prisma"
import { supabaseAdmin } from "../lib/supabase"
import { AuthServiceError, type SerializedProfile } from "./auth.service"

type DbClient = PrismaClient | Prisma.TransactionClient

type UserSummaryRecord = User & {
  coach: User | null
  _count: {
    meals: number
    programAssignments: number
    programsCreated: number
    trainees: number
    workoutLogs: number
  }
}

type ProgramSummaryRecord = Program & {
  createdBy: User
  _count: {
    assignments: number
    workouts: number
  }
}

type ExerciseSummaryRecord = Exercise & {
  createdBy: User | null
  _count: {
    workoutExercises: number
  }
}

type CoachRequestRecord = {
  coach: User
  coachId: string
  createdAt: Date
  id: string
  status: CoachRequestStatus
  trainee: User
  traineeId: string
  updatedAt: Date
}

type AuditLogRecord = AdminAuditLog & {
  admin: User
}

type ExerciseImportRowInput = {
  equipment?: string
  muscleGroup?: string
  name?: string
  rowNumber?: number
}

const DAILY_CHART_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
})

const MONTHLY_CHART_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
})

function ensurePrisma() {
  if (!prisma) {
    throw new AuthServiceError("Database is not configured.", 500)
  }

  return prisma
}

function assertAdmin(profile: SerializedProfile) {
  if (profile.role !== UserRole.admin) {
    throw new AuthServiceError("Chỉ admin mới có quyền truy cập dữ liệu này.", 403)
  }
}

function sanitizeText(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function normalizeSearch(value?: string | null) {
  return value?.trim().toLowerCase() ?? ""
}

function normalizePhoneDigits(value?: string | null) {
  return (value ?? "").replace(/\D/g, "")
}

function startOfDay(value = new Date()) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function startOfMonth(value = new Date()) {
  const date = new Date(value)
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date
}

function serializeMiniUser(user: Pick<User, "avatar" | "email" | "id" | "isActive" | "name" | "phone" | "role">) {
  return {
    avatar: user.avatar ?? undefined,
    email: user.email,
    id: user.id,
    isActive: user.isActive,
    name: user.name,
    phone: user.phone ?? undefined,
    role: user.role,
  }
}

function serializeUserListItem(user: UserSummaryRecord) {
  return {
    coach: user.coach ? serializeMiniUser(user.coach) : null,
    coachId: user.coachId,
    createdAt: user.createdAt,
    dailyCalorieGoal: user.dailyCalorieGoal,
    email: user.email,
    fitnessGoals: user.fitnessGoals,
    id: user.id,
    isActive: user.isActive,
    name: user.name,
    phone: user.phone ?? undefined,
    preferredWeightUnit: user.preferredWeightUnit,
    role: user.role,
    stats: {
      assignedPrograms: user._count.programAssignments,
      createdPrograms: user._count.programsCreated,
      meals: user._count.meals,
      trainees: user._count.trainees,
      workoutLogs: user._count.workoutLogs,
    },
    updatedAt: user.updatedAt,
    username: user.username ?? undefined,
  }
}

function serializeCoachRequest(request: CoachRequestRecord) {
  return {
    coach: serializeMiniUser(request.coach),
    coachId: request.coachId,
    createdAt: request.createdAt,
    id: request.id,
    status: request.status,
    trainee: serializeMiniUser(request.trainee),
    traineeId: request.traineeId,
    updatedAt: request.updatedAt,
  }
}

function serializeProgramSummary(program: ProgramSummaryRecord) {
  return {
    assignmentCount: program._count.assignments,
    createdAt: program.createdAt,
    createdBy: serializeMiniUser(program.createdBy),
    description: program.description ?? undefined,
    difficulty: program.difficulty,
    duration: program.duration,
    id: program.id,
    name: program.name,
    workoutsPerWeek: program.workoutsPerWeek || program._count.workouts,
  }
}

function serializeExerciseSummary(exercise: ExerciseSummaryRecord) {
  return {
    createdAt: exercise.createdAt,
    createdBy: exercise.createdBy ? serializeMiniUser(exercise.createdBy) : null,
    equipment: exercise.equipment ?? undefined,
    id: exercise.id,
    muscleGroup: exercise.muscleGroup,
    name: exercise.name,
    updatedAt: exercise.updatedAt,
    usageCount: exercise._count.workoutExercises,
  }
}

function serializeAuditLog(log: AuditLogRecord) {
  return {
    action: log.action,
    admin: serializeMiniUser(log.admin),
    createdAt: log.createdAt,
    entityId: log.entityId ?? undefined,
    entityLabel: log.entityLabel ?? undefined,
    entityType: log.entityType,
    id: log.id,
    metadata: log.metadata ?? undefined,
  }
}

function buildDailyCountSeries(values: Date[]) {
  const rangeStart = startOfDay(new Date())
  rangeStart.setDate(rangeStart.getDate() - 6)

  const totals = new Map<string, number>()

  values.forEach((value) => {
    if (value < rangeStart) {
      return
    }

    const bucket = startOfDay(value).toISOString()
    totals.set(bucket, (totals.get(bucket) ?? 0) + 1)
  })

  return Array.from({ length: 7 }, (_value, index) => {
    const bucketDate = new Date(rangeStart)
    bucketDate.setDate(rangeStart.getDate() + index)

    return {
      label: DAILY_CHART_FORMATTER.format(bucketDate),
      periodStart: bucketDate,
      value: totals.get(bucketDate.toISOString()) ?? 0,
    }
  })
}

function buildMonthlyCountSeries(values: Date[]) {
  const rangeStart = startOfMonth(new Date())
  rangeStart.setMonth(rangeStart.getMonth() - 5)

  const totals = new Map<string, number>()

  values.forEach((value) => {
    if (value < rangeStart) {
      return
    }

    const bucketDate = startOfMonth(value)
    const bucket = bucketDate.toISOString()
    totals.set(bucket, (totals.get(bucket) ?? 0) + 1)
  })

  return Array.from({ length: 6 }, (_value, index) => {
    const bucketDate = new Date(rangeStart)
    bucketDate.setMonth(rangeStart.getMonth() + index)

    return {
      label: MONTHLY_CHART_FORMATTER.format(bucketDate),
      periodStart: bucketDate,
      value: totals.get(bucketDate.toISOString()) ?? 0,
    }
  })
}

function buildDailyUniqueSeries(values: Array<{ occurredAt: Date; userId: string }>) {
  const rangeStart = startOfDay(new Date())
  rangeStart.setDate(rangeStart.getDate() - 6)

  const totals = new Map<string, Set<string>>()

  values.forEach((value) => {
    if (value.occurredAt < rangeStart) {
      return
    }

    const bucket = startOfDay(value.occurredAt).toISOString()
    const currentSet = totals.get(bucket) ?? new Set<string>()
    currentSet.add(value.userId)
    totals.set(bucket, currentSet)
  })

  return Array.from({ length: 7 }, (_value, index) => {
    const bucketDate = new Date(rangeStart)
    bucketDate.setDate(rangeStart.getDate() + index)

    return {
      label: DAILY_CHART_FORMATTER.format(bucketDate),
      periodStart: bucketDate,
      value: totals.get(bucketDate.toISOString())?.size ?? 0,
    }
  })
}

function buildMonthlyUniqueSeries(values: Array<{ occurredAt: Date; userId: string }>) {
  const rangeStart = startOfMonth(new Date())
  rangeStart.setMonth(rangeStart.getMonth() - 5)

  const totals = new Map<string, Set<string>>()

  values.forEach((value) => {
    if (value.occurredAt < rangeStart) {
      return
    }

    const bucketDate = startOfMonth(value.occurredAt)
    const bucket = bucketDate.toISOString()
    const currentSet = totals.get(bucket) ?? new Set<string>()
    currentSet.add(value.userId)
    totals.set(bucket, currentSet)
  })

  return Array.from({ length: 6 }, (_value, index) => {
    const bucketDate = new Date(rangeStart)
    bucketDate.setMonth(rangeStart.getMonth() + index)

    return {
      label: MONTHLY_CHART_FORMATTER.format(bucketDate),
      periodStart: bucketDate,
      value: totals.get(bucketDate.toISOString())?.size ?? 0,
    }
  })
}

function matchesSearch(parts: Array<string | null | undefined>, search: string) {
  if (!search) {
    return true
  }

  const normalizedSearch = search.toLowerCase()
  const normalizedDigits = normalizePhoneDigits(search)

  return parts.some((part) => {
    if (!part) {
      return false
    }

    const normalizedPart = part.toLowerCase()

    if (normalizedPart.includes(normalizedSearch)) {
      return true
    }

    if (normalizedDigits && normalizePhoneDigits(part).includes(normalizedDigits)) {
      return true
    }

    return false
  })
}

async function logAdminAudit(
  db: DbClient,
  adminId: string,
  input: {
    action: string
    entityId?: string
    entityLabel?: string
    entityType: string
    metadata?: Prisma.JsonObject
  },
) {
  await db.adminAuditLog.create({
    data: {
      action: input.action,
      adminId,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      entityType: input.entityType,
      metadata: input.metadata,
    },
  })
}

async function getAdminDashboard(profile: SerializedProfile) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const monthlyRangeStart = startOfMonth(new Date())
  monthlyRangeStart.setMonth(monthlyRangeStart.getMonth() - 5)
  const recent30Days = startOfDay(new Date())
  recent30Days.setDate(recent30Days.getDate() - 29)

  const [
    totalUsers,
    totalAdmins,
    totalCoaches,
    totalTrainees,
    totalPrograms,
    totalMeals,
    totalWorkoutLogs,
    pendingCoachRequests,
    recentUsers,
    topCoaches,
    recentPrograms,
    recentPendingCoachRequests,
    userGrowthDates,
    workoutActivity,
    mealActivity,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({
      where: {
        role: UserRole.admin,
      },
    }),
    db.user.count({
      where: {
        role: UserRole.coach,
      },
    }),
    db.user.count({
      where: {
        role: UserRole.trainee,
      },
    }),
    db.program.count(),
    db.meal.count(),
    db.workoutLog.count(),
    db.coachRequest.count({
      where: {
        status: CoachRequestStatus.pending,
      },
    }),
    db.user.findMany({
      include: {
        coach: true,
        _count: {
          select: {
            meals: true,
            programAssignments: true,
            programsCreated: true,
            trainees: true,
            workoutLogs: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
    }),
    db.user.findMany({
      include: {
        _count: {
          select: {
            programsCreated: true,
            trainees: true,
          },
        },
      },
      where: {
        role: UserRole.coach,
      },
    }),
    db.program.findMany({
      include: {
        _count: {
          select: {
            assignments: true,
            workouts: true,
          },
        },
        createdBy: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
    }),
    db.coachRequest.findMany({
      include: {
        coach: true,
        trainee: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
      where: {
        status: CoachRequestStatus.pending,
      },
    }),
    db.user.findMany({
      select: {
        createdAt: true,
      },
      where: {
        createdAt: {
          gte: monthlyRangeStart,
        },
      },
    }),
    db.workoutLog.findMany({
      select: {
        startedAt: true,
        userId: true,
      },
      where: {
        startedAt: {
          gte: monthlyRangeStart,
        },
      },
    }),
    db.meal.findMany({
      select: {
        recordedAt: true,
        userId: true,
      },
      where: {
        recordedAt: {
          gte: monthlyRangeStart,
        },
      },
    }),
  ])

  const userGrowth = userGrowthDates.map((entry) => entry.createdAt)
  const workoutLogDates = workoutActivity.map((entry) => entry.startedAt)
  const combinedActivity = [
    ...workoutActivity.map((entry) => ({
      occurredAt: entry.startedAt,
      userId: entry.userId,
    })),
    ...mealActivity.map((entry) => ({
      occurredAt: entry.recordedAt,
      userId: entry.userId,
    })),
  ]
  const activeUsersLast30Days = new Set(
    combinedActivity.filter((entry) => entry.occurredAt >= recent30Days).map((entry) => entry.userId),
  ).size
  const recent7DaysStart = startOfDay(new Date())
  recent7DaysStart.setDate(recent7DaysStart.getDate() - 6)
  const activeUsersLast7Days = new Set(
    combinedActivity.filter((entry) => entry.occurredAt >= recent7DaysStart).map((entry) => entry.userId),
  ).size

  return {
    charts: {
      activeUsers: {
        monthly: buildMonthlyUniqueSeries(combinedActivity),
        weekly: buildDailyUniqueSeries(combinedActivity),
      },
      userGrowth: {
        monthly: buildMonthlyCountSeries(userGrowth),
        weekly: buildDailyCountSeries(userGrowth),
      },
      workoutLogs: {
        monthly: buildMonthlyCountSeries(workoutLogDates),
        weekly: buildDailyCountSeries(workoutLogDates),
      },
    },
    pendingCoachRequests: recentPendingCoachRequests.map((request) => serializeCoachRequest(request as CoachRequestRecord)),
    recentPrograms: recentPrograms.map((program) => serializeProgramSummary(program as ProgramSummaryRecord)),
    recentUsers: recentUsers.map((user) => serializeUserListItem(user as UserSummaryRecord)),
    stats: {
      activeUsersLast30Days,
      activeUsersLast7Days,
      pendingCoachRequests,
      totalAdmins,
      totalCoaches,
      totalMeals,
      totalPrograms,
      totalTrainees,
      totalUsers,
      totalWorkoutLogs,
    },
    topCoaches: topCoaches
      .map((coach) => ({
        email: coach.email,
        id: coach.id,
        isActive: coach.isActive,
        name: coach.name,
        programCount: coach._count.programsCreated,
        traineeCount: coach._count.trainees,
      }))
      .sort((left, right) => right.traineeCount - left.traineeCount || right.programCount - left.programCount)
      .slice(0, 6),
  }
}

async function listAdminUsers(
  profile: SerializedProfile,
  options?: {
    role?: UserRole | "all"
    search?: string
  },
) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const users = await db.user.findMany({
    include: {
      coach: true,
      _count: {
        select: {
          meals: true,
          programAssignments: true,
          programsCreated: true,
          trainees: true,
          workoutLogs: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    where: options?.role && options.role !== "all" ? { role: options.role } : undefined,
  })

  const search = normalizeSearch(options?.search)

  return users
    .filter((user) =>
      matchesSearch([user.name, user.email, user.username, user.phone, user.coach?.name, user.coach?.email], search),
    )
    .map((user) => serializeUserListItem(user as UserSummaryRecord))
}

async function getAdminUserDetail(profile: SerializedProfile, userId: string) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const user = await db.user.findUnique({
    include: {
      coach: true,
      coachRequestsAsCoach: {
        include: {
          coach: true,
          trainee: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 6,
      },
      coachRequestsAsTrainee: {
        include: {
          coach: true,
          trainee: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 6,
      },
      programAssignments: {
        include: {
          program: {
            include: {
              _count: {
                select: {
                  assignments: true,
                  workouts: true,
                },
              },
              createdBy: true,
            },
          },
        },
        orderBy: {
          assignedAt: "desc",
        },
        take: 6,
      },
      programsCreated: {
        include: {
          _count: {
            select: {
              assignments: true,
              workouts: true,
            },
          },
          createdBy: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 6,
      },
      trainees: {
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
      },
      workoutLogs: {
        include: {
          workout: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          startedAt: "desc",
        },
        take: 8,
      },
      _count: {
        select: {
          meals: true,
          programAssignments: true,
          programsCreated: true,
          trainees: true,
          workoutLogs: true,
        },
      },
    },
    where: {
      id: userId,
    },
  })

  if (!user) {
    throw new AuthServiceError("Không tìm thấy người dùng.", 404)
  }

  const auditLogs = await db.adminAuditLog.findMany({
    include: {
      admin: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 8,
    where: {
      OR: [{ adminId: user.id }, { entityId: user.id }],
    },
  })

  return {
    assignedCoach: user.coach ? serializeMiniUser(user.coach) : null,
    assignedPrograms: user.programAssignments.map((assignment) =>
      serializeProgramSummary(assignment.program as ProgramSummaryRecord),
    ),
    coachRequests: [...user.coachRequestsAsCoach, ...user.coachRequestsAsTrainee]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 8)
      .map((request) => serializeCoachRequest(request as CoachRequestRecord)),
    connectedTrainees: user.trainees.map((trainee) => serializeMiniUser(trainee)),
    createdPrograms: user.programsCreated.map((program) => serializeProgramSummary(program as ProgramSummaryRecord)),
    recentAuditLogs: auditLogs.map((log) => serializeAuditLog(log as AuditLogRecord)),
    recentWorkoutLogs: user.workoutLogs.map((log) => ({
      completedAt: log.completedAt ?? undefined,
      id: log.id,
      startedAt: log.startedAt,
      totalVolume: log.totalVolume ?? undefined,
      workout: log.workout
        ? {
            id: log.workout.id,
            name: log.workout.name,
          }
        : null,
    })),
    user: serializeUserListItem(user as UserSummaryRecord),
  }
}

async function updateAdminUser(
  profile: SerializedProfile,
  userId: string,
  input: {
    isActive?: boolean
    role?: UserRole
  },
) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const existingUser = await db.user.findUnique({
    where: {
      id: userId,
    },
  })

  if (!existingUser) {
    throw new AuthServiceError("Không tìm thấy người dùng.", 404)
  }

  const nextRole = input.role ?? existingUser.role
  const nextIsActive = input.isActive ?? existingUser.isActive

  if (existingUser.id === profile.id && (nextRole !== UserRole.admin || !nextIsActive)) {
    throw new AuthServiceError("Bạn không thể tự hạ quyền hoặc tự khoá tài khoản admin đang đăng nhập.", 400)
  }

  if (existingUser.role === UserRole.admin && (nextRole !== UserRole.admin || !nextIsActive)) {
    const activeOtherAdmins = await db.user.count({
      where: {
        id: {
          not: existingUser.id,
        },
        isActive: true,
        role: UserRole.admin,
      },
    })

    if (activeOtherAdmins === 0) {
      throw new AuthServiceError("Hệ thống cần giữ lại ít nhất một admin đang hoạt động.", 400)
    }
  }

  const updatedUser = await db.$transaction(async (transaction) => {
    if (existingUser.role === UserRole.coach && nextRole !== UserRole.coach) {
      await transaction.user.updateMany({
        data: {
          coachId: null,
        },
        where: {
          coachId: existingUser.id,
        },
      })

      await transaction.coachRequest.updateMany({
        data: {
          status: CoachRequestStatus.rejected,
        },
        where: {
          coachId: existingUser.id,
          status: CoachRequestStatus.pending,
        },
      })
    }

    const updated = await transaction.user.update({
      data: {
        coachId: nextRole === UserRole.trainee ? existingUser.coachId : null,
        isActive: nextIsActive,
        programAssignments: nextRole === UserRole.trainee ? undefined : { deleteMany: {} },
        role: nextRole,
      },
      include: {
        coach: true,
        _count: {
          select: {
            meals: true,
            programAssignments: true,
            programsCreated: true,
            trainees: true,
            workoutLogs: true,
          },
        },
      },
      where: {
        id: existingUser.id,
      },
    })

    await logAdminAudit(transaction, profile.id, {
      action: "user.updated",
      entityId: updated.id,
      entityLabel: updated.email,
      entityType: "user",
      metadata: {
        isActive: nextIsActive,
        previousIsActive: existingUser.isActive,
        previousRole: existingUser.role,
        role: nextRole,
      },
    })

    return updated
  })

  if (supabaseAdmin && existingUser.supabaseAuthUserId) {
    try {
      await supabaseAdmin.auth.admin.updateUserById(existingUser.supabaseAuthUserId, {
        user_metadata: {
          isActive: nextIsActive,
          role: nextRole,
        },
      })
    } catch (error) {
      console.warn("Unable to sync admin user metadata to Supabase", error)
    }
  }

  return serializeUserListItem(updatedUser as UserSummaryRecord)
}

async function resetAdminUserPassword(profile: SerializedProfile, userId: string, password: string) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const trimmedPassword = password.trim()

  if (trimmedPassword.length < 6) {
    throw new AuthServiceError("Mật khẩu mới phải có ít nhất 6 ký tự.", 400)
  }

  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
  })

  if (!user) {
    throw new AuthServiceError("Không tìm thấy người dùng.", 404)
  }

  if (!user.supabaseAuthUserId || !supabaseAdmin) {
    throw new AuthServiceError("Không thể reset mật khẩu thủ công vì Supabase admin chưa được cấu hình.", 500)
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.supabaseAuthUserId, {
    password: trimmedPassword,
  })

  if (error) {
    throw new AuthServiceError(error.message, 400)
  }

  await logAdminAudit(db, profile.id, {
    action: "user.password_reset",
    entityId: user.id,
    entityLabel: user.email,
    entityType: "user",
  })

  return {
    success: true,
    userId: user.id,
  }
}

async function listAdminCoachRequests(
  profile: SerializedProfile,
  options?: {
    search?: string
    status?: CoachRequestStatus | "all"
  },
) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const requests = await db.coachRequest.findMany({
    include: {
      coach: true,
      trainee: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    where: options?.status && options.status !== "all" ? { status: options.status } : undefined,
  })

  const search = normalizeSearch(options?.search)

  return requests
    .filter((request) =>
      matchesSearch(
        [request.coach.name, request.coach.email, request.trainee.name, request.trainee.email],
        search,
      ),
    )
    .map((request) => serializeCoachRequest(request as CoachRequestRecord))
}

async function updateAdminCoachRequest(
  profile: SerializedProfile,
  requestId: string,
  status: CoachRequestStatus,
) {
  assertAdmin(profile)
  const db = ensurePrisma()

  if (status === CoachRequestStatus.pending) {
    throw new AuthServiceError("Trạng thái coach request không hợp lệ.", 400)
  }

  const existingRequest = await db.coachRequest.findUnique({
    include: {
      coach: true,
      trainee: true,
    },
    where: {
      id: requestId,
    },
  })

  if (!existingRequest) {
    throw new AuthServiceError("Không tìm thấy coach request.", 404)
  }

  if (existingRequest.status !== CoachRequestStatus.pending) {
    throw new AuthServiceError("Coach request này đã được xử lý trước đó.", 400)
  }

  const updatedRequest = await db.$transaction(async (transaction) => {
    const request = await transaction.coachRequest.update({
      data: {
        status,
      },
      include: {
        coach: true,
        trainee: true,
      },
      where: {
        id: existingRequest.id,
      },
    })

    if (status === CoachRequestStatus.approved) {
      await transaction.user.update({
        data: {
          coachId: request.coachId,
        },
        where: {
          id: request.traineeId,
        },
      })

      await transaction.coachRequest.updateMany({
        data: {
          status: CoachRequestStatus.rejected,
        },
        where: {
          coachId: {
            not: request.coachId,
          },
          traineeId: request.traineeId,
          status: {
            in: [CoachRequestStatus.pending, CoachRequestStatus.approved],
          },
        },
      })
    }

    await logAdminAudit(transaction, profile.id, {
      action: status === CoachRequestStatus.approved ? "coach_request.approved" : "coach_request.rejected",
      entityId: request.id,
      entityLabel: `${request.trainee.email} -> ${request.coach.email}`,
      entityType: "coach_request",
      metadata: {
        coachId: request.coachId,
        traineeId: request.traineeId,
      },
    })

    return request
  })

  return serializeCoachRequest(updatedRequest as CoachRequestRecord)
}

async function deleteAdminCoachRequest(profile: SerializedProfile, requestId: string) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const existingRequest = await db.coachRequest.findUnique({
    include: {
      coach: true,
      trainee: true,
    },
    where: {
      id: requestId,
    },
  })

  if (!existingRequest) {
    throw new AuthServiceError("Không tìm thấy coach request.", 404)
  }

  if (existingRequest.status === CoachRequestStatus.approved && existingRequest.trainee.coachId === existingRequest.coachId) {
    throw new AuthServiceError("Coach request đã được duyệt và đang là kết nối hiện tại. Hãy gỡ connection trước.", 400)
  }

  await db.$transaction(async (transaction) => {
    await transaction.coachRequest.delete({
      where: {
        id: existingRequest.id,
      },
    })

    await logAdminAudit(transaction, profile.id, {
      action: "coach_request.deleted",
      entityId: existingRequest.id,
      entityLabel: `${existingRequest.trainee.email} -> ${existingRequest.coach.email}`,
      entityType: "coach_request",
    })
  })

  return {
    deleted: true,
    id: existingRequest.id,
  }
}

async function listAdminConnections(profile: SerializedProfile, options?: { search?: string }) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const [trainees, coaches] = await Promise.all([
    db.user.findMany({
      include: {
        coach: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      where: {
        role: UserRole.trainee,
      },
    }),
    db.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      where: {
        isActive: true,
        role: UserRole.coach,
      },
    }),
  ])

  const search = normalizeSearch(options?.search)
  const connectedTrainees = trainees.filter((trainee) => trainee.coach)

  return {
    coaches: coaches.map((coach) => serializeMiniUser(coach)),
    connections: connectedTrainees
      .filter((trainee) => matchesSearch([trainee.name, trainee.email, trainee.coach?.name, trainee.coach?.email], search))
      .map((trainee) => ({
        coach: serializeMiniUser(trainee.coach as User),
        trainee: serializeMiniUser(trainee),
      })),
    unassignedTrainees: trainees
      .filter((trainee) => !trainee.coachId && trainee.isActive)
      .map((trainee) => serializeMiniUser(trainee)),
  }
}

async function assignAdminCoachToTrainee(
  profile: SerializedProfile,
  input: {
    coachId: string
    traineeId: string
  },
) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const [coach, trainee] = await Promise.all([
    db.user.findUnique({
      where: {
        id: input.coachId,
      },
    }),
    db.user.findUnique({
      where: {
        id: input.traineeId,
      },
    }),
  ])

  if (!coach || coach.role !== UserRole.coach) {
    throw new AuthServiceError("Coach được chọn không hợp lệ.", 400)
  }

  if (!trainee || trainee.role !== UserRole.trainee) {
    throw new AuthServiceError("Trainee được chọn không hợp lệ.", 400)
  }

  if (!coach.isActive || !trainee.isActive) {
    throw new AuthServiceError("Chỉ có thể tạo kết nối giữa các tài khoản đang hoạt động.", 400)
  }

  await db.$transaction(async (transaction) => {
    await transaction.user.update({
      data: {
        coachId: coach.id,
      },
      where: {
        id: trainee.id,
      },
    })

    await transaction.coachRequest.upsert({
      create: {
        coachId: coach.id,
        status: CoachRequestStatus.approved,
        traineeId: trainee.id,
      },
      update: {
        status: CoachRequestStatus.approved,
      },
      where: {
        traineeId_coachId: {
          coachId: coach.id,
          traineeId: trainee.id,
        },
      },
    })

    await transaction.coachRequest.updateMany({
      data: {
        status: CoachRequestStatus.rejected,
      },
      where: {
        coachId: {
          not: coach.id,
        },
        traineeId: trainee.id,
        status: {
          in: [CoachRequestStatus.pending, CoachRequestStatus.approved],
        },
      },
    })

    await logAdminAudit(transaction, profile.id, {
      action: "connection.assigned",
      entityId: trainee.id,
      entityLabel: trainee.email,
      entityType: "connection",
      metadata: {
        coachId: coach.id,
        coachName: coach.name,
        traineeId: trainee.id,
        traineeName: trainee.name,
      },
    })
  })

  return {
    coach: serializeMiniUser(coach),
    trainee: serializeMiniUser(trainee),
  }
}

async function removeAdminCoachFromTrainee(profile: SerializedProfile, traineeId: string) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const trainee = await db.user.findUnique({
    include: {
      coach: true,
    },
    where: {
      id: traineeId,
    },
  })

  if (!trainee || trainee.role !== UserRole.trainee) {
    throw new AuthServiceError("Không tìm thấy trainee.", 404)
  }

  if (!trainee.coachId || !trainee.coach) {
    throw new AuthServiceError("Trainee này hiện chưa được gán coach.", 400)
  }

  const currentCoach = trainee.coach

  await db.$transaction(async (transaction) => {
    await transaction.user.update({
      data: {
        coachId: null,
      },
      where: {
        id: trainee.id,
      },
    })

    await transaction.coachRequest.updateMany({
      data: {
        status: CoachRequestStatus.rejected,
      },
      where: {
        coachId: trainee.coachId as string,
        status: CoachRequestStatus.approved,
        traineeId: trainee.id,
      },
    })

    await logAdminAudit(transaction, profile.id, {
      action: "connection.removed",
      entityId: trainee.id,
      entityLabel: trainee.email,
      entityType: "connection",
      metadata: {
        coachId: trainee.coachId,
        coachName: currentCoach.name,
        traineeId: trainee.id,
        traineeName: trainee.name,
      },
    })
  })

  return {
    removed: true,
    traineeId: trainee.id,
  }
}

async function listAdminPrograms(profile: SerializedProfile, options?: { search?: string }) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const programs = await db.program.findMany({
    include: {
      _count: {
        select: {
          assignments: true,
          workouts: true,
        },
      },
      createdBy: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  const search = normalizeSearch(options?.search)

  return programs
    .filter((program) =>
      matchesSearch([program.name, program.description, program.createdBy.name, program.createdBy.email], search),
    )
    .map((program) => serializeProgramSummary(program as ProgramSummaryRecord))
}

async function deleteAdminProgram(profile: SerializedProfile, programId: string) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const program = await db.program.findUnique({
    include: {
      createdBy: true,
    },
    where: {
      id: programId,
    },
  })

  if (!program) {
    throw new AuthServiceError("Không tìm thấy chương trình.", 404)
  }

  await db.$transaction(async (transaction) => {
    await transaction.program.delete({
      where: {
        id: program.id,
      },
    })

    await logAdminAudit(transaction, profile.id, {
      action: "program.deleted",
      entityId: program.id,
      entityLabel: program.name,
      entityType: "program",
      metadata: {
        createdById: program.createdById,
        createdByName: program.createdBy.name,
      },
    })
  })

  return {
    deleted: true,
    id: program.id,
  }
}

async function listAdminExercises(profile: SerializedProfile, options?: { search?: string }) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const exercises = await db.exercise.findMany({
    include: {
      _count: {
        select: {
          workoutExercises: true,
        },
      },
      createdBy: true,
    },
    orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
  })

  const search = normalizeSearch(options?.search)

  return exercises
    .filter((exercise) => matchesSearch([exercise.name, exercise.muscleGroup, exercise.equipment], search))
    .map((exercise) => serializeExerciseSummary(exercise as ExerciseSummaryRecord))
}

async function createAdminExercise(
  profile: SerializedProfile,
  input: {
    equipment?: string
    muscleGroup: string
    name: string
  },
) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const name = sanitizeText(input.name)
  const muscleGroup = sanitizeText(input.muscleGroup)
  const equipment = sanitizeText(input.equipment)

  if (!name || !muscleGroup) {
    throw new AuthServiceError("Tên bài tập và nhóm cơ không được để trống.", 400)
  }

  const exercise = await db.exercise.create({
    data: {
      createdById: profile.id,
      equipment,
      muscleGroup,
      name,
    },
    include: {
      _count: {
        select: {
          workoutExercises: true,
        },
      },
      createdBy: true,
    },
  })

  await logAdminAudit(db, profile.id, {
    action: "exercise.created",
    entityId: exercise.id,
    entityLabel: exercise.name,
    entityType: "exercise",
  })

  return serializeExerciseSummary(exercise as ExerciseSummaryRecord)
}

async function importAdminExercises(
  profile: SerializedProfile,
  rows: ExerciseImportRowInput[],
) {
  assertAdmin(profile)
  const db = ensurePrisma()

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AuthServiceError("File import không có dữ liệu bài tập hợp lệ.", 400)
  }

  if (rows.length > 1000) {
    throw new AuthServiceError("Chỉ hỗ trợ import tối đa 1000 dòng mỗi lần.", 400)
  }

  const sanitizedRows = rows.map((row, index) => ({
    equipment: sanitizeText(row.equipment),
    muscleGroup: sanitizeText(row.muscleGroup),
    name: sanitizeText(row.name),
    rowNumber: row.rowNumber ?? index + 2,
  }))

  const invalidRows = sanitizedRows.filter((row) => !row.name || !row.muscleGroup)

  if (invalidRows.length > 0) {
    const invalidPreview = invalidRows
      .slice(0, 5)
      .map((row) => row.rowNumber)
      .join(", ")

    throw new AuthServiceError(
      `Có dòng thiếu tên bài tập hoặc nhóm cơ. Kiểm tra lại các dòng: ${invalidPreview}${invalidRows.length > 5 ? "..." : ""}`,
      400,
    )
  }

  function buildSignature(row: { equipment?: string | null; muscleGroup?: string | null; name?: string | null }) {
    return `${row.name?.trim().toLowerCase() ?? ""}::${row.muscleGroup?.trim().toLowerCase() ?? ""}::${row.equipment?.trim().toLowerCase() ?? ""}`
  }

  const duplicateRowsInFile: Array<{
    equipment?: string
    muscleGroup: string
    name: string
    reason: "duplicate_in_file"
    rowNumber: number
  }> = []
  const uniqueRows: Array<{
    equipment?: string
    muscleGroup: string
    name: string
    rowNumber: number
  }> = []
  const seenSignatures = new Set<string>()

  sanitizedRows.forEach((row) => {
    const signature = buildSignature(row)

    if (seenSignatures.has(signature)) {
      duplicateRowsInFile.push({
        equipment: row.equipment,
        muscleGroup: row.muscleGroup as string,
        name: row.name as string,
        reason: "duplicate_in_file",
        rowNumber: row.rowNumber,
      })
      return
    }

    seenSignatures.add(signature)
    uniqueRows.push({
      equipment: row.equipment,
      muscleGroup: row.muscleGroup as string,
      name: row.name as string,
      rowNumber: row.rowNumber,
    })
  })

  const existingExercises = await db.exercise.findMany({
    select: {
      equipment: true,
      muscleGroup: true,
      name: true,
    },
  })

  const existingSignatures = new Set(existingExercises.map((exercise) => buildSignature(exercise)))
  const rowsToCreate: Array<{
    createdById: string
    equipment?: string
    muscleGroup: string
    name: string
  }> = []
  const duplicateRowsExisting: Array<{
    equipment?: string
    muscleGroup: string
    name: string
    reason: "already_exists"
    rowNumber: number
  }> = []

  uniqueRows.forEach((row) => {
    const signature = buildSignature(row)

    if (existingSignatures.has(signature)) {
      duplicateRowsExisting.push({
        equipment: row.equipment,
        muscleGroup: row.muscleGroup,
        name: row.name,
        reason: "already_exists",
        rowNumber: row.rowNumber,
      })
      return
    }

    rowsToCreate.push({
      createdById: profile.id,
      equipment: row.equipment,
      muscleGroup: row.muscleGroup,
      name: row.name,
    })
    existingSignatures.add(signature)
  })

  if (rowsToCreate.length > 0) {
    await db.exercise.createMany({
      data: rowsToCreate,
    })
  }

  await logAdminAudit(db, profile.id, {
    action: "exercise.imported",
    entityLabel: `Imported ${rowsToCreate.length} exercises`,
    entityType: "exercise",
    metadata: {
      createdCount: rowsToCreate.length,
      duplicateInFileCount: duplicateRowsInFile.length,
      existingDuplicateCount: duplicateRowsExisting.length,
      totalRows: rows.length,
    },
  })

  return {
    createdCount: rowsToCreate.length,
    skippedCount: duplicateRowsInFile.length + duplicateRowsExisting.length,
    skippedRows: [...duplicateRowsInFile, ...duplicateRowsExisting].slice(0, 20),
    totalRows: rows.length,
  }
}

async function updateAdminExercise(
  profile: SerializedProfile,
  exerciseId: string,
  input: {
    equipment?: string
    muscleGroup: string
    name: string
  },
) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const name = sanitizeText(input.name)
  const muscleGroup = sanitizeText(input.muscleGroup)
  const equipment = sanitizeText(input.equipment)

  if (!name || !muscleGroup) {
    throw new AuthServiceError("Tên bài tập và nhóm cơ không được để trống.", 400)
  }

  const existingExercise = await db.exercise.findUnique({
    where: {
      id: exerciseId,
    },
  })

  if (!existingExercise) {
    throw new AuthServiceError("Không tìm thấy bài tập.", 404)
  }

  const exercise = await db.exercise.update({
    data: {
      equipment,
      muscleGroup,
      name,
    },
    include: {
      _count: {
        select: {
          workoutExercises: true,
        },
      },
      createdBy: true,
    },
    where: {
      id: existingExercise.id,
    },
  })

  await logAdminAudit(db, profile.id, {
    action: "exercise.updated",
    entityId: exercise.id,
    entityLabel: exercise.name,
    entityType: "exercise",
    metadata: {
      previousEquipment: existingExercise.equipment,
      previousMuscleGroup: existingExercise.muscleGroup,
      previousName: existingExercise.name,
    },
  })

  return serializeExerciseSummary(exercise as ExerciseSummaryRecord)
}

async function deleteAdminExercise(profile: SerializedProfile, exerciseId: string) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const exercise = await db.exercise.findUnique({
    include: {
      _count: {
        select: {
          workoutExercises: true,
        },
      },
    },
    where: {
      id: exerciseId,
    },
  })

  if (!exercise) {
    throw new AuthServiceError("Không tìm thấy bài tập.", 404)
  }

  if (exercise._count.workoutExercises > 0) {
    throw new AuthServiceError("Bài tập này đang được sử dụng trong workout, chưa thể xoá.", 400)
  }

  await db.$transaction(async (transaction) => {
    await transaction.exercise.delete({
      where: {
        id: exercise.id,
      },
    })

    await logAdminAudit(transaction, profile.id, {
      action: "exercise.deleted",
      entityId: exercise.id,
      entityLabel: exercise.name,
      entityType: "exercise",
    })
  })

  return {
    deleted: true,
    id: exercise.id,
  }
}

async function listAdminAuditLogs(
  profile: SerializedProfile,
  options?: {
    entityType?: string
    search?: string
  },
) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const logs = await db.adminAuditLog.findMany({
    include: {
      admin: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
    where: options?.entityType && options.entityType !== "all" ? { entityType: options.entityType } : undefined,
  })

  const search = normalizeSearch(options?.search)

  return logs
    .filter((log) =>
      matchesSearch([log.action, log.entityType, log.entityLabel, log.admin.name, log.admin.email], search),
    )
    .map((log) => serializeAuditLog(log as AuditLogRecord))
}

export {
  assignAdminCoachToTrainee,
  createAdminExercise,
  importAdminExercises,
  deleteAdminCoachRequest,
  deleteAdminExercise,
  deleteAdminProgram,
  getAdminDashboard,
  getAdminUserDetail,
  listAdminAuditLogs,
  listAdminCoachRequests,
  listAdminConnections,
  listAdminExercises,
  listAdminPrograms,
  listAdminUsers,
  removeAdminCoachFromTrainee,
  resetAdminUserPassword,
  updateAdminCoachRequest,
  updateAdminExercise,
  updateAdminUser,
}
