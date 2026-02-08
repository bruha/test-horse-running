import { useStore } from "vuex"
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
import { HORSE_RACE_MUTATIONS, type HorseRaceStoreState } from "~/store"

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

let horseMapCache: HorseMap = new Map()
let simulationAccumulatorMs = 0
let intermissionHandle: ReturnType<typeof setTimeout> | null = null

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
  const store = useStore<HorseRaceStoreState>()

  const horses = computed(() => store.state.horses)
  const program = computed(() => store.state.program)
  const results = computed(() => store.state.results)
  const activeRound = computed(() => store.state.activeRound)
  const isRunning = computed(() => store.state.isRunning)
  const isPaused = computed(() => store.state.isPaused)
  const eventLog = computed(() => store.state.eventLog)
  const seed = computed(() => store.state.seed)

  const hasProgram = computed(
    () => horses.value.length === DEFAULT_HORSE_COUNT && program.value.length === TOTAL_ROUNDS
  )
  const isCompleted = computed(
    () => hasProgram.value && results.value.length === program.value.length && !activeRound.value
  )
  const canStart = computed(() => hasProgram.value && !isCompleted.value && !isRunning.value)
  const canPause = computed(() => Boolean(activeRound.value) && isRunning.value)
  const canReset = computed(
    () =>
      horses.value.length > 0 ||
      program.value.length > 0 ||
      results.value.length > 0 ||
      Boolean(activeRound.value) ||
      isRunning.value ||
      isPaused.value ||
      eventLog.value.length > 0
  )
  const leaderboard = computed(() => buildLeaderboard(horses.value, results.value))

  function setHorses(nextHorses: Horse[]) {
    store.commit(HORSE_RACE_MUTATIONS.SET_HORSES, nextHorses)
  }

  function setProgram(nextProgram: RaceRound[]) {
    store.commit(HORSE_RACE_MUTATIONS.SET_PROGRAM, nextProgram)
  }

  function setResults(nextResults: RoundResult[]) {
    store.commit(HORSE_RACE_MUTATIONS.SET_RESULTS, nextResults)
  }

  function setActiveRound(nextRound: RoundState | null) {
    store.commit(HORSE_RACE_MUTATIONS.SET_ACTIVE_ROUND, nextRound)
  }

  function setIsRunning(nextIsRunning: boolean) {
    store.commit(HORSE_RACE_MUTATIONS.SET_IS_RUNNING, nextIsRunning)
  }

  function setIsPaused(nextIsPaused: boolean) {
    store.commit(HORSE_RACE_MUTATIONS.SET_IS_PAUSED, nextIsPaused)
  }

  function setEventLog(nextEventLog: string[]) {
    store.commit(HORSE_RACE_MUTATIONS.SET_EVENT_LOG, nextEventLog)
  }

  function setSeed(nextSeed: number) {
    store.commit(HORSE_RACE_MUTATIONS.SET_SEED, nextSeed)
  }

  function clearIntermission() {
    if (intermissionHandle) {
      clearTimeout(intermissionHandle)
      intermissionHandle = null
    }
  }

  function ensureHorseMapCache() {
    if (horseMapCache.size !== horses.value.length) {
      horseMapCache = createHorseMap(horses.value)
    }
  }

  function appendLog(message: string) {
    const timestamp = new Date().toLocaleTimeString("en-US", TIMESTAMP_FORMAT)
    setEventLog([`${timestamp} ${message}`, ...eventLog.value].slice(0, EVENT_LOG_LIMIT))
  }

  function setRoundStatus(roundIndex: number, status: RoundStatus) {
    store.commit(HORSE_RACE_MUTATIONS.SET_ROUND_STATUS, { roundIndex, status })
  }

  function clearRoundState() {
    setActiveRound(null)
    setIsRunning(false)
    setIsPaused(false)
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
    setSeed(nextSeed)

    const rng = createSeededRng(nextSeed)
    const nextHorses = createHorsePool(DEFAULT_HORSE_COUNT, rng)
    const nextProgram = withStatus(buildRaceSchedule(nextHorses, rng))

    setHorses(nextHorses)
    setProgram(nextProgram)
    setResults([])
    clearRoundState()
    setEventLog([])

    horseMapCache = createHorseMap(nextHorses)

    appendLog(`Generated ${DEFAULT_HORSE_COUNT} horses and a ${TOTAL_ROUNDS}-round schedule.`)
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

    ensureHorseMapCache()
    clearIntermission()
    setRoundStatus(roundIndex, ROUND_STATUS.RUNNING)

    setActiveRound(createRoundState(nextRound, horseMapCache))
    simulationAccumulatorMs = 0
    setIsPaused(false)
    setIsRunning(true)

    appendLog(`Round ${nextRound.id} started (${nextRound.distance}m).`)
  }

  function togglePause() {
    if (!canPause.value) {
      return
    }

    const nextIsPaused = !isPaused.value
    setIsPaused(nextIsPaused)

    if (nextIsPaused) {
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

    setResults([...results.value, result])
    setRoundStatus(finishedRoundIndex, ROUND_STATUS.FINISHED)

    const winner = result.order[0]
    appendLog(
      `Round ${result.roundId} finished. Winner: ${winner.horseName} (${(winner.timeMs / MILLISECONDS_IN_SECOND).toFixed(ROUND_TIME_DECIMALS)}s).`
    )

    clearRoundState()

    if (results.value.length < program.value.length) {
      intermissionHandle = setTimeout(() => {
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
    store.commit(HORSE_RACE_MUTATIONS.RESET_GAME_STATE)
    horseMapCache = new Map()
    simulationAccumulatorMs = 0
  }

  function renderSnapshot(): string {
    ensureHorseMapCache()
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
    canReset,
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
