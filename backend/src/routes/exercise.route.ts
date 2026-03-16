import { Router } from "express"

import { requireCurrentProfile } from "../services/auth.service"
import { listExercises } from "../services/fitness-data.service"
import { getAccessToken, sendError } from "./route.utils"

const exerciseRouter = Router()

exerciseRouter.get("/", async (req, res) => {
  try {
    await requireCurrentProfile(getAccessToken(req))
    const exercises = await listExercises()

    res.json({
      exercises,
    })
  } catch (error) {
    sendError(res, error)
  }
})

export { exerciseRouter }
