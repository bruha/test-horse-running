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
  type RoundResult,
  type RoundState
} from "~/utils/raceEngine"

const STATE_KEYS = Object.freeze({
  HORSES: "horse-race-horses",
  PROGRAM: "horse-race-program",
  RESULTS: "horse-race-results",
  ACTIVE_ROUND: "horse-race-active-round",
  IS_RUNNING: "horse-race-is-running",
  IS_PAUSED: "horse-race-is-paused",
  EVENT_LOG: "horse-race-event-log",
  SEED: "horse-race-seed",
  INTERMISSION_HANDLE: "horse-race-intermission-handle"
} as const)

const INTERMISSION_MS = 900
const SIMULATION_SPEED = 12
const SIMULATION_STEP_MS = 48
const MAX_FRAME_DELTA_MS = 120
const MAX_STEPS_PER_FRAME = 8
const MAX_ACCUMULATED_SIMULATION_MS = SIMULATION_STEP_MS * MAX_STEPS_PER_FRAME

const EVENT_LOG_LIMIT = 16
const TOP_POSITION_POINTS = Object.freeze({
  FIRST: 5,
  SECOND: 3,
  THIRD: 2,
  PARTICIPATION: 1
} as const)

const PODIUM_POSITION = Object.freeze({
  FIRST: 1,
  SECOND: 2,
  THIRD: 3
} as const)

const TIMESTAMP_FORMAT: Intl.DateTimeFormatOptions = Object.freeze({
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
})

const MILLISECONDS_IN_SECOND = 1000
const TOTAL_ROUNDS = ROUND_DISTANCES.length
const SNAPSHOT_MODE = Object.freeze({
  IDLE: "idle",
  PAUSED: "paused",
  RACING: "racing",
  FINISHED: "finished",
  READY: "ready"
} as const)

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

      if (item.position === PODIUM_POSITION.FIRST) {
        row.wins += 1
        row.podiums += 1
        row.points += TOP_POSITION_POINTS.FIRST
      } else if (item.position === PODIUM_POSITION.SECOND) {
        row.podiums += 1
        row.points += TOP_POSITION_POINTS.SECOND
      } else if (item.position === PODIUM_POSITION.THIRD) {
        row.podiums += 1
        row.points += TOP_POSITION_POINTS.THIRD
      } else {
        row.points += TOP_POSITION_POINTS.PARTICIPATION
      }
    }
  }

  return [...summary.values()]
    .map((row) => ({
      ...row,
      avgTimeMs: row.rounds > 0 ? Number((row.totalTimeMs / row.rounds).toFixed(2)) : 0
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
      const leftCondition = leftHorse?.condition ?? 0
      const rightCondition = rightHorse?.condition ?? 0
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
    () => horses.value.length === DEFAULT_HORSE_COUNT && program.value.length === ROUND_DISTANCES.length
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

  function generateProgram(nextSeed: number = Date.now()) {
    clearIntermission()
    seed.value = nextSeed
    const rng = createSeededRng(nextSeed)

    horses.value = createHorsePool(DEFAULT_HORSE_COUNT, rng)
    horseMapCache = createHorseMap(horses.value)
    program.value = withStatus(buildRaceSchedule(horses.value, rng))
    results.value = []
    activeRound.value = null
    isRunning.value = false
    isPaused.value = false
    eventLog.value = []
    simulationAccumulatorMs = 0

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
    program.value = program.value.map((round, index) => {
      if (index === roundIndex) {
        return { ...round, status: ROUND_STATUS.RUNNING }
      }
      return round
    })

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
    program.value = program.value.map((round, index) => {
      if (index === finishedRoundIndex) {
        return { ...round, status: ROUND_STATUS.FINISHED }
      }
      return round
    })

    const winner = result.order[0]
    appendLog(
      `Round ${result.roundId} finished. Winner: ${winner.horseName} (${(winner.timeMs / MILLISECONDS_IN_SECOND).toFixed(2)}s).`
    )

    activeRound.value = null
    isRunning.value = false
    isPaused.value = false

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
    activeRound.value = null
    isRunning.value = false
    isPaused.value = false
    eventLog.value = []
    seed.value = 0
    horseMapCache = new Map()
    simulationAccumulatorMs = 0
  }

  function renderSnapshot(): string {
    const latestResult = results.value[results.value.length - 1] ?? null
    const mode: SnapshotPayload["mode"] = !hasProgram.value
      ? SNAPSHOT_MODE.IDLE
      : activeRound.value
        ? isPaused.value
          ? SNAPSHOT_MODE.PAUSED
          : SNAPSHOT_MODE.RACING
        : isCompleted.value
          ? SNAPSHOT_MODE.FINISHED
          : SNAPSHOT_MODE.READY

    const payload: SnapshotPayload = {
      mode,
      coordinateSystem: "x: 0->100 progress left-to-right, y: lane 1->10 top-to-bottom",
      rounds: {
        total: program.value.length,
        completed: results.value.length
      },
      activeRound: activeRound.value
        ? {
            id: activeRound.value.roundId,
            distance: activeRound.value.distance,
            elapsedMs: Number(activeRound.value.elapsedMs.toFixed(2)),
            entries: activeRound.value.entries.map((entry) => {
              const horse = horseMapCache.get(entry.horseId)
              return {
                horseId: entry.horseId,
                horseName: horse?.name ?? entry.horseId,
                lane: entry.lane,
                progress: Number(entry.progress.toFixed(3)),
                speedMps: Number(entry.lastSpeed.toFixed(2)),
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
