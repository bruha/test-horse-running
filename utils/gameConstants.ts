export const MILLISECONDS_IN_SECOND = 1000

export const HORSE_FALLBACK_COLOR = "#94a3b8"

export const HORSE_ART_ASSETS = {
  RUNNING_MASK: "/images/running-horse-mask.apng",
  STANDING_MASK: "/images/running-horse-stand-mask.png"
} as const

export const TRACK_PROGRESS_LIMITS = {
  MIN: 0,
  MAX: 1
} as const

export const TRACK_MARKERS = [0, 25, 50, 75, 100]
export const TRACK_IDLE_LABEL = "No race is active"

export const ROUND_STATUS_LABELS = {
  pending: "Scheduled",
  running: "Running",
  finished: "Finished"
} as const

export const RESULTS_EMPTY_MESSAGE = "Race results will appear after each round."

export const SNAPSHOT_COORDINATE_SYSTEM =
  "x: 0->100 progress left-to-right, y: lane 1->10 top-to-bottom"
