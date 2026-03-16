import { ProgramDifficulty } from "@prisma/client"
import { Router } from "express"

import { requireCurrentProfile } from "../services/auth.service"
import { createCoachProgram, getCoachDashboard, listCoachPrograms, listCoachTrainees } from "../services/fitness-data.service"
import { getAccessToken, sendError } from "./route.utils"

const coachRouter = Router()

coachRouter.get("/dashboard", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await getCoachDashboard(profile.profile)

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.get("/programs", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const programs = await listCoachPrograms(profile.profile)

    res.json({
      programs,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.post("/programs", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const program = await createCoachProgram(profile.profile, {
      assignToUserIds: Array.isArray(req.body.assignToUserIds)
        ? req.body.assignToUserIds.map((value: unknown) => String(value))
        : undefined,
      description: typeof req.body.description === "string" ? req.body.description : undefined,
      difficulty: Object.values(ProgramDifficulty).includes(req.body.difficulty)
        ? req.body.difficulty
        : ProgramDifficulty.beginner,
      duration: Number(req.body.duration ?? 0),
      name: String(req.body.name ?? ""),
      workouts: Array.isArray(req.body.workouts)
        ? req.body.workouts.map((workout: unknown) => {
            const record = workout && typeof workout === "object" ? workout : {}
            const safeRecord = record as {
              duration?: unknown
              exercises?: unknown
              name?: unknown
              scheduledDay?: unknown
            }

            return {
              duration: safeRecord.duration == null ? undefined : Number(safeRecord.duration),
              exercises: Array.isArray(safeRecord.exercises)
                ? safeRecord.exercises.map((exercise: unknown) => {
                    const exerciseRecord = exercise && typeof exercise === "object" ? exercise : {}
                    const safeExercise = exerciseRecord as {
                      exerciseId?: unknown
                      reps?: unknown
                      restTime?: unknown
                      sets?: unknown
                    }

                    return {
                      exerciseId: String(safeExercise.exerciseId ?? ""),
                      reps: Number(safeExercise.reps ?? 0),
                      restTime: safeExercise.restTime == null ? undefined : Number(safeExercise.restTime),
                      sets: Number(safeExercise.sets ?? 0),
                    }
                  })
                : [],
              name: String(safeRecord.name ?? ""),
              scheduledDay: typeof safeRecord.scheduledDay === "number" ? safeRecord.scheduledDay : undefined,
            }
          })
        : [],
    })

    res.status(201).json({
      program,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.get("/trainees", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const trainees = await listCoachTrainees(profile.profile)

    res.json({
      trainees,
    })
  } catch (error) {
    sendError(res, error)
  }
})

export { coachRouter }
