import {
  CoachRequestStatus,
  ProgramDifficulty,
  UserRole,
  type Exercise,
  type ExerciseSet,
  type Meal,
  type Program,
  type ProgramAssignment,
  type User,
  type Workout,
  type WorkoutExercise,
  type WorkoutLog,
} from "@prisma/client"

import { AuthServiceError, type SerializedProfile } from "./auth.service"
import { prisma } from "../lib/prisma"

type WorkoutRecord = Workout & {
  exercises: Array<
    WorkoutExercise & {
      exercise: Exercise
      sets: ExerciseSet[]
    }
  >
}

type ProgramRecord = Program & {
  assignments: Array<
    ProgramAssignment & {
      user: User
    }
  >
  workouts: WorkoutRecord[]
}

type WorkoutLogRecord = WorkoutLog & {
  workout: WorkoutRecord | null
}

const DEFAULT_CALORIE_TARGET = 2500
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DEFAULT_EXERCISES = [
  { equipment: "Barbell", muscleGroup: "Chest", name: "Bench Press" },
  { equipment: "Barbell", muscleGroup: "Legs", name: "Back Squat" },
  { equipment: "Barbell", muscleGroup: "Back", name: "Deadlift" },
  { equipment: "Dumbbell", muscleGroup: "Shoulders", name: "Shoulder Press" },
  { equipment: "Cable", muscleGroup: "Back", name: "Lat Pulldown" },
  { equipment: "Machine", muscleGroup: "Legs", name: "Leg Press" },
  { equipment: "Dumbbell", muscleGroup: "Chest", name: "Incline Dumbbell Press" },
  { equipment: "Cable", muscleGroup: "Arms", name: "Tricep Pushdown" },
  { equipment: "Dumbbell", muscleGroup: "Arms", name: "Bicep Curl" },
  { equipment: "Bodyweight", muscleGroup: "Core", name: "Plank" },
]

function ensurePrisma() {
  if (!prisma) {
    throw new AuthServiceError("Database is not configured.", 500)
  }

  return prisma
}

function assertCoach(profile: SerializedProfile) {
  if (profile.role !== UserRole.coach) {
    throw new AuthServiceError("Chỉ coach mới có quyền truy cập dữ liệu này.", 403)
  }
}

function toDateRange(date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  end.setMilliseconds(-1)

  return { end, start }
}

function toRecentWindow(days: number) {
  const end = new Date()
  end.setHours(23, 59, 59, 999)

  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)

  return { end, start }
}

function serializeExercise(exercise: Exercise) {
  return {
    equipment: exercise.equipment ?? undefined,
    id: exercise.id,
    muscleGroup: exercise.muscleGroup,
    name: exercise.name,
  }
}

function serializeExerciseSet(set: ExerciseSet) {
  return {
    actualReps: set.actualReps ?? undefined,
    completed: set.completed,
    id: set.id,
    notes: set.notes ?? undefined,
    rir: set.rir ?? undefined,
    setNumber: set.setNumber,
    targetReps: set.targetReps,
    weight: set.weight ?? undefined,
  }
}

function serializeWorkout(workout: WorkoutRecord) {
  return {
    duration: workout.duration ?? undefined,
    exercises: workout.exercises
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((exercise) => ({
        exercise: serializeExercise(exercise.exercise),
        id: exercise.id,
        notes: exercise.notes ?? undefined,
        restTime: exercise.restTime ?? undefined,
        sets: exercise.sets
          .slice()
          .sort((left, right) => left.setNumber - right.setNumber)
          .map(serializeExerciseSet),
      })),
    id: workout.id,
    name: workout.name,
    notes: workout.notes ?? undefined,
    scheduledDay: workout.scheduledDay ?? undefined,
  }
}

function serializeMeal(meal: Meal) {
  return {
    calories: meal.calories,
    carbs: meal.carbs ?? undefined,
    fat: meal.fat ?? undefined,
    id: meal.id,
    name: meal.name,
    protein: meal.protein ?? undefined,
    time: meal.recordedAt,
    type: meal.type,
  }
}

function serializeProgram(program: ProgramRecord) {
  return {
    assignedTo: program.assignments.map((assignment) => assignment.userId),
    assignedTrainees: program.assignments.map((assignment) => ({
      avatar: assignment.user.avatar,
      email: assignment.user.email,
      fitnessGoals: assignment.user.fitnessGoals,
      id: assignment.user.id,
      name: assignment.user.name,
    })),
    createdAt: program.createdAt,
    createdBy: program.createdById,
    description: program.description ?? undefined,
    difficulty: program.difficulty,
    duration: program.duration,
    id: program.id,
    name: program.name,
    workouts: program.workouts
      .slice()
      .sort((left, right) => (left.scheduledDay ?? 7) - (right.scheduledDay ?? 7))
      .map(serializeWorkout),
    workoutsPerWeek: program.workoutsPerWeek,
  }
}

function serializeCoachRequest(request: {
  coachId: string
  createdAt: Date
  id: string
  status: CoachRequestStatus
  trainee: User
  traineeId: string
}) {
  return {
    coachId: request.coachId,
    createdAt: request.createdAt,
    id: request.id,
    status: request.status,
    trainee: {
      avatar: request.trainee.avatar,
      email: request.trainee.email,
      fitnessGoals: request.trainee.fitnessGoals,
      id: request.trainee.id,
      name: request.trainee.name,
    },
    traineeId: request.traineeId,
  }
}

function serializeWorkoutLog(log: WorkoutLogRecord) {
  const snapshotWorkout =
    log.workoutSnapshot && typeof log.workoutSnapshot === "object" && !Array.isArray(log.workoutSnapshot)
      ? (log.workoutSnapshot as { duration?: number; id?: string; name?: string; notes?: string; scheduledDay?: number })
      : null

  const snapshotExercises =
    Array.isArray(log.exerciseSnapshot)
      ? (log.exerciseSnapshot as ReturnType<typeof serializeWorkout>["exercises"])
      : null

  return {
    completedAt: log.completedAt,
    exercises: snapshotExercises ?? (log.workout ? serializeWorkout(log.workout).exercises : []),
    id: log.id,
    notes: log.notes ?? undefined,
    startedAt: log.startedAt,
    totalVolume: log.totalVolume ?? undefined,
    workout: log.workout
      ? serializeWorkout(log.workout)
      : {
          duration: snapshotWorkout?.duration,
          exercises: snapshotExercises ?? [],
          id: snapshotWorkout?.id ?? log.workoutId ?? log.id,
          name: snapshotWorkout?.name ?? "Workout",
          notes: snapshotWorkout?.notes,
          scheduledDay: snapshotWorkout?.scheduledDay,
        },
  }
}

function buildWeeklyCaloriesChart(meals: Array<Pick<Meal, "calories" | "recordedAt">>, targetCalories = DEFAULT_CALORIE_TARGET) {
  const { start } = toRecentWindow(7)
  const totals = new Map<string, number>()

  meals.forEach((meal) => {
    const key = meal.recordedAt.toISOString().slice(0, 10)
    totals.set(key, (totals.get(key) ?? 0) + meal.calories)
  })

  return Array.from({ length: 7 }, (_value, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)

    const key = date.toISOString().slice(0, 10)

    return {
      calories: totals.get(key) ?? 0,
      day: DAY_LABELS[date.getDay()],
      target: targetCalories,
    }
  })
}

function calculateWorkoutVolume(exercises: Array<{ sets?: Array<{ actualReps?: number; completed?: boolean; targetReps?: number; weight?: number }> }>) {
  return exercises.reduce((volumeTotal, exercise) => {
    const setVolume = (exercise.sets ?? []).reduce((setTotal, set) => {
      if (!set.completed || !set.weight) {
        return setTotal
      }

      const reps = set.actualReps ?? set.targetReps ?? 0
      return setTotal + set.weight * reps
    }, 0)

    return volumeTotal + setVolume
  }, 0)
}

async function ensureDefaultExercises() {
  const db = ensurePrisma()
  const currentCount = await db.exercise.count()

  if (currentCount === 0) {
    await db.exercise.createMany({
      data: DEFAULT_EXERCISES,
    })
  }

  return db.exercise.findMany({
    orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
  })
}

async function listExercises() {
  const exercises = await ensureDefaultExercises()
  return exercises.map(serializeExercise)
}

async function listMealsForUser(profile: SerializedProfile, date = new Date()) {
  const db = ensurePrisma()
  const { end, start } = toDateRange(date)
  const recentWindow = toRecentWindow(7)

  const [meals, weeklyMeals] = await Promise.all([
    db.meal.findMany({
      orderBy: {
        recordedAt: "asc",
      },
      where: {
        recordedAt: {
          gte: start,
          lte: end,
        },
        userId: profile.id,
      },
    }),
    db.meal.findMany({
      orderBy: {
        recordedAt: "asc",
      },
      select: {
        calories: true,
        recordedAt: true,
      },
      where: {
        recordedAt: {
          gte: recentWindow.start,
          lte: recentWindow.end,
        },
        userId: profile.id,
      },
    }),
  ])

  const serializedMeals = meals.map(serializeMeal)
  const totalCalories = serializedMeals.reduce((total, meal) => total + meal.calories, 0)

  return {
    dailyNutrition: {
      date: start,
      meals: serializedMeals,
      targetCalories: DEFAULT_CALORIE_TARGET,
      totalCalories,
    },
    meals: serializedMeals,
    weeklyCalories: buildWeeklyCaloriesChart(weeklyMeals),
  }
}

async function createMealForUser(
  profile: SerializedProfile,
  input: {
    calories: number
    carbs?: number
    fat?: number
    name: string
    protein?: number
    recordedAt?: string | null
    type: Meal["type"]
  },
) {
  const db = ensurePrisma()

  if (!input.name.trim()) {
    throw new AuthServiceError("Tên bữa ăn không được để trống.")
  }

  const meal = await db.meal.create({
    data: {
      calories: Math.max(0, Math.round(input.calories)),
      carbs: input.carbs != null ? Math.round(input.carbs) : undefined,
      fat: input.fat != null ? Math.round(input.fat) : undefined,
      name: input.name.trim(),
      protein: input.protein != null ? Math.round(input.protein) : undefined,
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
      type: input.type,
      userId: profile.id,
    },
  })

  return serializeMeal(meal)
}

async function deleteMealForUser(profile: SerializedProfile, mealId: string) {
  const db = ensurePrisma()
  const meal = await db.meal.findFirst({
    where: {
      id: mealId,
      userId: profile.id,
    },
  })

  if (!meal) {
    throw new AuthServiceError("Không tìm thấy bữa ăn.", 404)
  }

  await db.meal.delete({
    where: {
      id: mealId,
    },
  })

  return {
    deleted: true,
    id: mealId,
  }
}

async function listWorkoutsForTrainee(profile: SerializedProfile) {
  const db = ensurePrisma()
  const assignments = await db.programAssignment.findMany({
    include: {
      program: {
        include: {
          workouts: {
            include: {
              exercises: {
                include: {
                  exercise: true,
                  sets: {
                    orderBy: {
                      setNumber: "asc",
                    },
                  },
                },
                orderBy: {
                  order: "asc",
                },
              },
            },
            orderBy: [{ scheduledDay: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
    where: {
      userId: profile.id,
    },
  })

  const workoutMap = new Map<string, WorkoutRecord>()

  assignments.flatMap((assignment) => assignment.program.workouts as WorkoutRecord[]).forEach((workout) => {
    workoutMap.set(workout.id, workout)
  })

  const serializedWorkouts = Array.from(workoutMap.values())
    .sort((left, right) => (left.scheduledDay ?? 7) - (right.scheduledDay ?? 7))
    .map(serializeWorkout)

  const recentLogs = await db.workoutLog.findMany({
    include: {
      workout: {
        include: {
          exercises: {
            include: {
              exercise: true,
              sets: {
                orderBy: {
                  setNumber: "asc",
                },
              },
            },
            orderBy: {
              order: "asc",
            },
          },
        },
      },
    },
    orderBy: {
      startedAt: "desc",
    },
    take: 5,
    where: {
      userId: profile.id,
    },
  })

  const schedule = DAY_LABELS.reduce<Record<number, ReturnType<typeof serializeWorkout> | null>>((accumulator, _label, index) => {
    const workout = serializedWorkouts.find((item) => item.scheduledDay === index)
    accumulator[index] = workout ?? null
    return accumulator
  }, {})

  return {
    recentLogs: recentLogs.map((log) => serializeWorkoutLog(log as WorkoutLogRecord)),
    schedule,
    todayWorkout: schedule[new Date().getDay()] ?? null,
    workouts: serializedWorkouts,
  }
}

async function getWorkoutDetailForTrainee(profile: SerializedProfile, workoutId: string) {
  const db = ensurePrisma()
  const workout = await db.workout.findFirst({
    include: {
      exercises: {
        include: {
          exercise: true,
          sets: {
            orderBy: {
              setNumber: "asc",
            },
          },
        },
        orderBy: {
          order: "asc",
        },
      },
    },
    where: {
      id: workoutId,
      program: {
        assignments: {
          some: {
            userId: profile.id,
          },
        },
      },
    },
  })

  if (!workout) {
    throw new AuthServiceError("Không tìm thấy workout.", 404)
  }

  return serializeWorkout(workout as WorkoutRecord)
}

async function createWorkoutLogForTrainee(
  profile: SerializedProfile,
  workoutId: string,
  input: {
    completedAt?: string | null
    exercises: ReturnType<typeof serializeWorkout>["exercises"]
    notes?: string | null
    startedAt?: string | null
  },
) {
  const db = ensurePrisma()
  const workout = await db.workout.findFirst({
    include: {
      exercises: {
        include: {
          exercise: true,
          sets: {
            orderBy: {
              setNumber: "asc",
            },
          },
        },
        orderBy: {
          order: "asc",
        },
      },
    },
    where: {
      id: workoutId,
      program: {
        assignments: {
          some: {
            userId: profile.id,
          },
        },
      },
    },
  })

  if (!workout) {
    throw new AuthServiceError("Không tìm thấy workout.", 404)
  }

  const serializedWorkout = serializeWorkout(workout as WorkoutRecord)
  const totalVolume = calculateWorkoutVolume(input.exercises)

  const log = await db.workoutLog.create({
    data: {
      completedAt: input.completedAt ? new Date(input.completedAt) : new Date(),
      exerciseSnapshot: input.exercises,
      notes: input.notes?.trim() || undefined,
      startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
      totalVolume,
      userId: profile.id,
      workoutId: workout.id,
      workoutSnapshot: {
        duration: serializedWorkout.duration,
        id: serializedWorkout.id,
        name: serializedWorkout.name,
        notes: serializedWorkout.notes,
        scheduledDay: serializedWorkout.scheduledDay,
      },
    },
    include: {
      workout: {
        include: {
          exercises: {
            include: {
              exercise: true,
              sets: {
                orderBy: {
                  setNumber: "asc",
                },
              },
            },
            orderBy: {
              order: "asc",
            },
          },
        },
      },
    },
  })

  return serializeWorkoutLog(log as WorkoutLogRecord)
}

async function listCoachPrograms(profile: SerializedProfile) {
  assertCoach(profile)
  const db = ensurePrisma()
  const programs = await db.program.findMany({
    include: {
      assignments: {
        include: {
          user: true,
        },
      },
      workouts: {
        include: {
          exercises: {
            include: {
              exercise: true,
              sets: {
                orderBy: {
                  setNumber: "asc",
                },
              },
            },
            orderBy: {
              order: "asc",
            },
          },
        },
        orderBy: [{ scheduledDay: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    where: {
      createdById: profile.id,
    },
  })

  return programs.map((program) => serializeProgram(program as ProgramRecord))
}

async function createCoachProgram(
  profile: SerializedProfile,
  input: {
    assignToUserIds?: string[]
    description?: string | null
    difficulty: ProgramDifficulty
    duration: number
    name: string
    workouts: Array<{
      duration?: number
      exercises: Array<{
        exerciseId: string
        reps: number
        restTime?: number
        sets: number
      }>
      name: string
      scheduledDay?: number
    }>
  },
) {
  const db = ensurePrisma()
  assertCoach(profile)

  if (!input.name.trim()) {
    throw new AuthServiceError("Tên chương trình không được để trống.")
  }

  if (input.workouts.length === 0) {
    throw new AuthServiceError("Chương trình cần ít nhất một buổi tập.")
  }

  const assignToUserIds = Array.from(new Set((input.assignToUserIds ?? []).filter(Boolean)))

  if (assignToUserIds.length > 0) {
    const validTrainees = await db.user.count({
      where: {
        coachId: profile.id,
        id: {
          in: assignToUserIds,
        },
        role: UserRole.trainee,
      },
    })

    if (validTrainees !== assignToUserIds.length) {
      throw new AuthServiceError("Chỉ có thể gán chương trình cho trainee thuộc coach này.", 400)
    }
  }

  const program = await db.program.create({
    data: {
      assignments:
        assignToUserIds.length > 0
          ? {
              create: assignToUserIds.map((userId) => ({
                userId,
              })),
            }
          : undefined,
      createdById: profile.id,
      description: input.description?.trim() || undefined,
      difficulty: input.difficulty,
      duration: Math.max(1, Math.round(input.duration)),
      name: input.name.trim(),
      workouts: {
        create: input.workouts.map((workout, workoutIndex) => ({
          duration: workout.duration ? Math.max(1, Math.round(workout.duration)) : undefined,
          exercises: {
            create: workout.exercises.map((exercise, exerciseIndex) => ({
              exerciseId: exercise.exerciseId,
              order: exerciseIndex + 1,
              restTime: exercise.restTime ? Math.max(0, Math.round(exercise.restTime)) : undefined,
              sets: {
                create: Array.from({ length: Math.max(1, Math.round(exercise.sets)) }, (_value, setIndex) => ({
                  setNumber: setIndex + 1,
                  targetReps: Math.max(1, Math.round(exercise.reps)),
                })),
              },
            })),
          },
          name: workout.name.trim() || `Day ${workoutIndex + 1}`,
          scheduledDay: typeof workout.scheduledDay === "number" ? workout.scheduledDay : undefined,
        })),
      },
      workoutsPerWeek: input.workouts.length,
    },
    include: {
      assignments: {
        include: {
          user: true,
        },
      },
      workouts: {
        include: {
          exercises: {
            include: {
              exercise: true,
              sets: {
                orderBy: {
                  setNumber: "asc",
                },
              },
            },
            orderBy: {
              order: "asc",
            },
          },
        },
        orderBy: [{ scheduledDay: "asc" }, { createdAt: "asc" }],
      },
    },
  })

  return serializeProgram(program as ProgramRecord)
}

async function listCoachTrainees(profile: SerializedProfile) {
  assertCoach(profile)
  const db = ensurePrisma()
  const trainees = await db.user.findMany({
    include: {
      _count: {
        select: {
          programAssignments: true,
          workoutLogs: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    where: {
      coachId: profile.id,
      role: UserRole.trainee,
    },
  })

  const traineeIds = trainees.map((trainee) => trainee.id)
  const recentWindow = toRecentWindow(7)
  const recentLogs = traineeIds.length
    ? await db.workoutLog.findMany({
        select: {
          userId: true,
        },
        where: {
          startedAt: {
            gte: recentWindow.start,
            lte: recentWindow.end,
          },
          userId: {
            in: traineeIds,
          },
        },
      })
    : []

  const thisWeekByUser = recentLogs.reduce<Map<string, number>>((accumulator, log) => {
    accumulator.set(log.userId, (accumulator.get(log.userId) ?? 0) + 1)
    return accumulator
  }, new Map())

  return trainees.map((trainee) => ({
    avatar: trainee.avatar,
    createdAt: trainee.createdAt,
    email: trainee.email,
    fitnessGoals: trainee.fitnessGoals,
    id: trainee.id,
    name: trainee.name,
    programCount: trainee._count.programAssignments,
    thisWeekWorkouts: thisWeekByUser.get(trainee.id) ?? 0,
    totalWorkoutLogs: trainee._count.workoutLogs,
  }))
}

async function getCoachDashboard(profile: SerializedProfile) {
  assertCoach(profile)
  const db = ensurePrisma()
  const [trainees, pendingRequests] = await Promise.all([
    listCoachTrainees(profile),
    db.coachRequest.findMany({
      include: {
        trainee: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      where: {
        coachId: profile.id,
        status: CoachRequestStatus.pending,
      },
    }),
  ])

  return {
    pendingRequests: pendingRequests.map(serializeCoachRequest),
    trainees,
  }
}

export {
  createCoachProgram,
  createMealForUser,
  createWorkoutLogForTrainee,
  deleteMealForUser,
  getCoachDashboard,
  getWorkoutDetailForTrainee,
  listCoachPrograms,
  listCoachTrainees,
  listExercises,
  listMealsForUser,
  listWorkoutsForTrainee,
}
