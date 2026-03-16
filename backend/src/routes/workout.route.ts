import { Router } from "express"

import { requireCurrentProfile } from "../services/auth.service"
import { createWorkoutLogForTrainee, getWorkoutDetailForTrainee, listWorkoutsForTrainee } from "../services/fitness-data.service"
import { getAccessToken, sendError } from "./route.utils"

const workoutRouter = Router()

workoutRouter.get("/", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await listWorkoutsForTrainee(profile.profile)

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

workoutRouter.get("/:workoutId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const workout = await getWorkoutDetailForTrainee(profile.profile, String(req.params.workoutId))

    res.json({
      workout,
    })
  } catch (error) {
    sendError(res, error)
  }
})

workoutRouter.post("/:workoutId/logs", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const log = await createWorkoutLogForTrainee(profile.profile, String(req.params.workoutId), {
      completedAt: typeof req.body.completedAt === "string" ? req.body.completedAt : undefined,
      exercises: Array.isArray(req.body.exercises) ? req.body.exercises : [],
      notes: typeof req.body.notes === "string" ? req.body.notes : undefined,
      startedAt: typeof req.body.startedAt === "string" ? req.body.startedAt : undefined,
    })

    res.status(201).json({
      log,
    })
  } catch (error) {
    sendError(res, error)
  }
})

export { workoutRouter }
