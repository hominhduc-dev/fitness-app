type RepTargetInput = {
  reps?: number | null
  repsMin?: number | null
}

type ParsedRepTarget = {
  reps: number
  repsMin?: number
}

function normalizeRepTargetValue(value: number) {
  return Math.max(1, Math.round(value))
}

function formatRepTarget(input: RepTargetInput) {
  if (input.reps == null || !Number.isFinite(input.reps)) {
    return "?"
  }

  const reps = normalizeRepTargetValue(input.reps)
  const repsMin =
    input.repsMin != null && Number.isFinite(input.repsMin) ? normalizeRepTargetValue(input.repsMin) : undefined

  if (repsMin != null && repsMin < reps) {
    return `${repsMin}-${reps}`
  }

  return String(reps)
}

function parseRepTargetText(value: string): ParsedRepTarget | null {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return null
  }

  const match = normalizedValue.match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/)

  if (!match) {
    return null
  }

  const repsMin = Number(match[1])
  const repsMax = match[2] ? Number(match[2]) : undefined

  if (repsMax == null) {
    return repsMin > 0 ? { reps: repsMin } : null
  }

  if (repsMin <= 0 || repsMax <= 0 || repsMin >= repsMax) {
    return null
  }

  return {
    reps: repsMax,
    repsMin,
  }
}

export { formatRepTarget, parseRepTargetText }
export type { ParsedRepTarget, RepTargetInput }
