import type { Request, Response } from "express"

import { AuthServiceError } from "../services/auth.service"

function getAccessToken(req: Request) {
  const header = req.headers.authorization

  if (!header?.startsWith("Bearer ")) {
    throw new AuthServiceError("Thiếu access token trong header Authorization.", 401)
  }

  return header.replace(/^Bearer\s+/i, "").trim()
}

function sendError(res: Response, error: unknown) {
  if (error instanceof AuthServiceError) {
    return res.status(error.status).json({
      error: error.message,
    })
  }

  console.error(error)

  return res.status(500).json({
    error: "Internal Server Error",
  })
}

export { getAccessToken, sendError }
