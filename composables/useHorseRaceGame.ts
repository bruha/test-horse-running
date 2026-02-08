import {
  ROUND_DISTANCES,
  DEFAULT_HORSE_COUNT,
  ROUND_STATUS,
  createSeededRng,
  createHorsePool,
  buildRaceSchedule,
  createHorseMap,
  createRoundState,
  stepRound,
  buildRoundResult,
  type Horse,
  type HorseMap,
  type RaceRound,
  type RoundStatus,
  type RoundResult,
  type RoundState
} from "~/utils/raceEngine"
import { MILLISECONDS_IN_SECOND, SNAPSHOT_COORDINATE_SYSTEM } from "~/utils/gameConstants"

const STATE_KEYS = {
  HORSES: "horse-race-horses",
  PROGRAM: "horse-race-program",
  RESULTS: "horse-race-results",
  ACTIVE_ROUND: "horse-race-active-round",
  IS_RUNNING: "horse-race-is-running",
  IS_PAUSED: "horse-race-is-paused",
  EVENT_LOG: "horse-race-event-log",
  SEED: "horse-race-seed",
  INTERMISSION_HANDLE: "horse-race-intermission-handle"
} as const

const INTERMISSION_MS = 900
const SIMULATION_SPEED = 12
const SIMULATION_STEP_MS = 48
const MAX_FRAME_DELTA_MS = 120
const MAX_STEPS_PER_FRAME = 8
const MAX_ACCUMULATED_SIMULATION_MS = SIMULATION_STEP_MS * MAX_STEPS_PER_FRAME

const EVENT_LOG_LIMIT = 16
const PODIUM_FIRST_POSITION = 1
const PODIUM_MAX_POSITION = 3
const PARTICIPATION_POINTS = 1
const POINTS_BY_PODIUM_POSITION: Record<number, number> = {
  1: 5,
  2: 3,
  3: 2
}

const LEADERBOARD_AVERAGE_DECIMALS = 2
const ROUND_TIME_DECIMALS = 2
const SNAPSHOT_ELAPSED_MS_DECIMALS = 2
const SNAPSHOT_PROGRESS_DECIMALS = 3
const SNAPSHOT_SPEED_DECIMALS = 2
const FALLBACK_CONDITION_SCORE = 0

const TIMESTAMP_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
}

const TOTAL_ROUNDS = ROUND_DISTANCES.length
const SNAPSHOT_MODE = {
  IDLE: "idle",
  PAUSED: "paused",
  RACING: "racing",
  FINISHED: "finished",
  READY: "ready"
} as const

const CHAMPIONSHIP_COMPLETE_MESSAGE = `Championship complete. All ${TOTAL_ROUNDS} rounds finished.`

interface LeaderboardRow {
  horseId: string
  name: string
  color: string
  condition: number
  rounds: number
  podiums: number
  wins: number
  points: number
  totalTimeMs: number
  avgTimeMs: number
}

interface SnapshotEntry {
  horseId: string
  horseName: string
  lane: number
  progress: number
  speedMps: number
  finished: boolean
}

interface SnapshotPayload {
  mode: (typeof SNAPSHOT_MODE)[keyof typeof SNAPSHOT_MODE]
  coordinateSystem: string
  rounds: {
    total: number
    completed: number
  }
  activeRound: {
    id: number
    distance: number
    elapsedMs: number
    entries: SnapshotEntry[]
  } | null
  latestResult: {
    roundId: number
    winner: string | null
  } | null
}

function withStatus(schedule: RaceRound[]): RaceRound[] {
  return schedule.map((round) => ({
    ...round,
    status: ROUND_STATUS.PENDING
  }))
}

function buildLeaderboard(horses: Horse[], results: RoundResult[]): LeaderboardRow[] {
  const horseLookup = new Map(horses.map((horse) => [horse.id, horse]))
  const summary = new Map<string, Omit<LeaderboardRow, "avgTimeMs">>(
    horses.map((horse) => [
      horse.id,
      {
        horseId: horse.id,
        name: horse.name,
        color: horse.color,
        condition: horse.condition,
        rounds: 0,
        podiums: 0,
        wins: 0,
        points: 0,
        totalTimeMs: 0
      }
    ])
  )

  for (const roundResult of results) {
    for (const item of roundResult.order) {
      const row = summary.get(item.horseId)
      if (!row) {
        continue
      }

      row.rounds += 1
      row.totalTimeMs += item.timeMs

      if (item.position === PODIUM_FIRST_POSITION) {
        row.wins += 1
      }

      if (item.position <= PODIUM_MAX_POSITION) {
        row.podiums += 1
      }

      row.points += POINTS_BY_PODIUM_POSITION[item.position] ?? PARTICIPATION_POINTS
    }
  }

  return [...summary.values()]
    .map((row) => ({
      ...row,
      avgTimeMs:
        row.rounds > 0
          ? Number((row.totalTimeMs / row.rounds).toFixed(LEADERBOARD_AVERAGE_DECIMALS))
          : 0
    }))
    .sort((left, right) => {
      if (left.points !== right.points) {
        return right.points - left.points
      }
      if (left.avgTimeMs !== right.avgTimeMs) {
        return left.avgTimeMs - right.avgTimeMs
      }

      const leftHorse = horseLookup.get(left.horseId)
      const rightHorse = horseLookup.get(right.horseId)
      const leftCondition = leftHorse?.condition ?? FALLBACK_CONDITION_SCORE
      const rightCondition = rightHorse?.condition ?? FALLBACK_CONDITION_SCORE
      return rightCondition - leftCondition
    })
}

export function useHorseRaceGame() {
  const horses = useState<Horse[]>(STATE_KEYS.HORSES, () => [])
  const program = useState<RaceRound[]>(STATE_KEYS.PROGRAM, () => [])
  const results = useState<RoundResult[]>(STATE_KEYS.RESULTS, () => [])
  const activeRound = useState<RoundState | null>(STATE_KEYS.ACTIVE_ROUND, () => null)
  const isRunning = useState<boolean>(STATE_KEYS.IS_RUNNING, () => false)
  const isPaused = useState<boolean>(STATE_KEYS.IS_PAUSED, () => false)
  const eventLog = useState<string[]>(STATE_KEYS.EVENT_LOG, () => [])
  const seed = useState<number>(STATE_KEYS.SEED, () => 0)
  const intermissionHandle = useState<ReturnType<typeof setTimeout> | null>(
    STATE_KEYS.INTERMISSION_HANDLE,
    () => null
  )

  const hasProgram = computed(
    () => horses.value.length === DEFAULT_HORSE_COUNT && program.value.length === TOTAL_ROUNDS
  )
  const isCompleted = computed(
    () => hasProgram.value && results.value.length === program.value.length && !activeRound.value
  )
  const canStart = computed(() => hasProgram.value && !isCompleted.value && !isRunning.value)
  const canPause = computed(() => Boolean(activeRound.value) && isRunning.value)
  const leaderboard = computed(() => buildLeaderboard(horses.value, results.value))

  let horseMapCache: HorseMap = new Map()
  let simulationAccumulatorMs = 0

  function appendLog(message: string) {
    const timestamp = new Date().toLocaleTimeString("en-US", TIMESTAMP_FORMAT)
    eventLog.value = [`${timestamp} ${message}`, ...eventLog.value].slice(0, EVENT_LOG_LIMIT)
  }

  function clearIntermission() {
    if (intermissionHandle.value) {
      clearTimeout(intermissionHandle.value)
      intermissionHandle.value = null
    }
  }

  function setRoundStatus(roundIndex: number, status: RoundStatus) {
    program.value = program.value.map((round, index) =>
      index === roundIndex ? { ...round, status } : round
    )
  }

  function clearRoundState() {
    activeRound.value = null
    isRunning.value = false
    isPaused.value = false
    simulationAccumulatorMs = 0
  }

  function resolveSnapshotMode(): SnapshotPayload["mode"] {
    if (!hasProgram.value) {
      return SNAPSHOT_MODE.IDLE
    }
    if (activeRound.value && isPaused.value) {
      return SNAPSHOT_MODE.PAUSED
    }
    if (activeRound.value) {
      return SNAPSHOT_MODE.RACING
    }
    if (isCompleted.value) {
      return SNAPSHOT_MODE.FINISHED
    }
    return SNAPSHOT_MODE.READY
  }

  function generateProgram(nextSeed: number = Date.now()) {
    clearIntermission()
    seed.value = nextSeed
    const rng = createSeededRng(nextSeed)

    horses.value = createHorsePool(DEFAULT_HORSE_COUNT, rng)
    horseMapCache = createHorseMap(horses.value)
    program.value = withStatus(buildRaceSchedule(horses.value, rng))
    results.value = []
    clearRoundState()
    eventLog.value = []

    appendLog(`Generated ${DEFAULT_HORSE_COUNT} horses and a ${TOTAL_ROUNDS}-round schedule (seed ${nextSeed}).`)
  }

  function start() {
    if (!canStart.value) {
      return
    }

    const roundIndex = results.value.length
    const nextRound = program.value[roundIndex]
    if (!nextRound) {
      return
    }

    clearIntermission()
    setRoundStatus(roundIndex, ROUND_STATUS.RUNNING)

    activeRound.value = createRoundState(nextRound, horseMapCache)
    simulationAccumulatorMs = 0
    isPaused.value = false
    isRunning.value = true

    appendLog(`Round ${nextRound.id} started (${nextRound.distance}m).`)
  }

  function togglePause() {
    if (!canPause.value) {
      return
    }

    isPaused.value = !isPaused.value
    if (isPaused.value) {
      appendLog(`Round ${activeRound.value?.roundId} paused.`)
    } else {
      appendLog(`Round ${activeRound.value?.roundId} resumed.`)
    }
  }

  function finishRound(horseMap: HorseMap) {
    if (!activeRound.value) {
      return
    }

    const currentRoundState = activeRound.value
    const finishedRoundIndex = results.value.length
    const result = buildRoundResult(currentRoundState, horseMap)

    results.value = [...results.value, result]
    setRoundStatus(finishedRoundIndex, ROUND_STATUS.FINISHED)

    const winner = result.order[0]
    appendLog(
      `Round ${result.roundId} finished. Winner: ${winner.horseName} (${(winner.timeMs / MILLISECONDS_IN_SECOND).toFixed(ROUND_TIME_DECIMALS)}s).`
    )

    clearRoundState()

    if (results.value.length < program.value.length) {
      intermissionHandle.value = setTimeout(() => {
        start()
      }, INTERMISSION_MS)
    } else {
      appendLog(CHAMPIONSHIP_COMPLETE_MESSAGE)
    }
  }

  function advanceBy(deltaMs: number) {
    if (!activeRound.value || !isRunning.value || isPaused.value || deltaMs <= 0) {
      return
    }

    const clampedDeltaMs = Math.min(MAX_FRAME_DELTA_MS, deltaMs)
    simulationAccumulatorMs = Math.min(
      MAX_ACCUMULATED_SIMULATION_MS,
      simulationAccumulatorMs + clampedDeltaMs * SIMULATION_SPEED
    )

    let stepsProcessed = 0
    while (
      simulationAccumulatorMs >= SIMULATION_STEP_MS &&
      activeRound.value &&
      !activeRound.value.complete &&
      stepsProcessed < MAX_STEPS_PER_FRAME
    ) {
      stepRound(activeRound.value, SIMULATION_STEP_MS, horseMapCache, Math.random)
      simulationAccumulatorMs -= SIMULATION_STEP_MS
      stepsProcessed += 1
    }

    if (stepsProcessed >= MAX_STEPS_PER_FRAME && simulationAccumulatorMs >= SIMULATION_STEP_MS) {
      simulationAccumulatorMs = 0
    }

    if (activeRound.value?.complete) {
      simulationAccumulatorMs = 0
      finishRound(horseMapCache)
    }
  }

  function resetGame() {
    clearIntermission()
    horses.value = []
    program.value = []
    results.value = []
    clearRoundState()
    eventLog.value = []
    seed.value = 0
    horseMapCache = new Map()
  }

  function renderSnapshot(): string {
    const latestResult = results.value[results.value.length - 1] ?? null

    const payload: SnapshotPayload = {
      mode: resolveSnapshotMode(),
      coordinateSystem: SNAPSHOT_COORDINATE_SYSTEM,
      rounds: {
        total: program.value.length,
        completed: results.value.length
      },
      activeRound: activeRound.value
        ? {
            id: activeRound.value.roundId,
            distance: activeRound.value.distance,
            elapsedMs: Number(activeRound.value.elapsedMs.toFixed(SNAPSHOT_ELAPSED_MS_DECIMALS)),
            entries: activeRound.value.entries.map((entry) => {
              const horse = horseMapCache.get(entry.horseId)
              return {
                horseId: entry.horseId,
                horseName: horse?.name ?? entry.horseId,
                lane: entry.lane,
                progress: Number(entry.progress.toFixed(SNAPSHOT_PROGRESS_DECIMALS)),
                speedMps: Number(entry.lastSpeed.toFixed(SNAPSHOT_SPEED_DECIMALS)),
                finished: entry.finishTimeMs !== null
              }
            })
          }
        : null,
      latestResult: latestResult
        ? {
            roundId: latestResult.roundId,
            winner: latestResult.order[0]?.horseName ?? null
          }
        : null
    }

    return JSON.stringify(payload)
  }

  return {
    horses,
    program,
    results,
    activeRound,
    isRunning,
    isPaused,
    hasProgram,
    isCompleted,
    canStart,
    canPause,
    seed,
    eventLog,
    leaderboard,
    generateProgram,
    start,
    togglePause,
    advanceBy,
    resetGame,
    renderSnapshot
  }
}
