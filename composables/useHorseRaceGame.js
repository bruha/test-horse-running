import {
  ROUND_DISTANCES,
  createSeededRng,
  createHorsePool,
  buildRaceSchedule,
  createHorseMap,
  createRoundState,
  stepRound,
  buildRoundResult
} from "~/utils/raceEngine.mjs"

const INTERMISSION_MS = 900
const SIMULATION_SPEED = 12
const SIMULATION_STEP_MS = 48
const MAX_FRAME_DELTA_MS = 120
const MAX_STEPS_PER_FRAME = 8
const MAX_ACCUMULATED_SIMULATION_MS = SIMULATION_STEP_MS * MAX_STEPS_PER_FRAME

function withStatus(schedule) {
  return schedule.map((round) => ({
    ...round,
    status: "pending"
  }))
}

function buildLeaderboard(horses, results) {
  const horseLookup = new Map(horses.map((horse) => [horse.id, horse]))
  const summary = new Map(
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

      if (item.position === 1) {
        row.wins += 1
        row.podiums += 1
        row.points += 5
      } else if (item.position === 2) {
        row.podiums += 1
        row.points += 3
      } else if (item.position === 3) {
        row.podiums += 1
        row.points += 2
      } else {
        row.points += 1
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
  const horses = useState("horse-race-horses", () => [])
  const program = useState("horse-race-program", () => [])
  const results = useState("horse-race-results", () => [])
  const activeRound = useState("horse-race-active-round", () => null)
  const isRunning = useState("horse-race-is-running", () => false)
  const isPaused = useState("horse-race-is-paused", () => false)
  const eventLog = useState("horse-race-event-log", () => [])
  const seed = useState("horse-race-seed", () => 0)
  const intermissionHandle = useState("horse-race-intermission-handle", () => null)

  const hasProgram = computed(
    () => horses.value.length === 20 && program.value.length === ROUND_DISTANCES.length
  )
  const isCompleted = computed(
    () => hasProgram.value && results.value.length === program.value.length && !activeRound.value
  )
  const canStart = computed(() => hasProgram.value && !isCompleted.value && !isRunning.value)
  const canPause = computed(() => Boolean(activeRound.value) && isRunning.value)

  const leaderboard = computed(() => buildLeaderboard(horses.value, results.value))
  let horseMapCache = new Map()
  let simulationAccumulatorMs = 0

  function appendLog(message) {
    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    })
    eventLog.value = [`${timestamp} ${message}`, ...eventLog.value].slice(0, 16)
  }

  function clearIntermission() {
    if (intermissionHandle.value) {
      clearTimeout(intermissionHandle.value)
      intermissionHandle.value = null
    }
  }

  function generateProgram(nextSeed = Date.now()) {
    clearIntermission()
    seed.value = nextSeed
    const rng = createSeededRng(nextSeed)

    horses.value = createHorsePool(20, rng)
    horseMapCache = createHorseMap(horses.value)
    program.value = withStatus(buildRaceSchedule(horses.value, rng))
    results.value = []
    activeRound.value = null
    isRunning.value = false
    isPaused.value = false
    eventLog.value = []
    simulationAccumulatorMs = 0

    appendLog(`Generated 20 horses and a 6-round schedule (seed ${nextSeed}).`)
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
        return { ...round, status: "running" }
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

  function finishRound(horseMap) {
    if (!activeRound.value) {
      return
    }

    const currentRoundState = activeRound.value
    const finishedRoundIndex = results.value.length
    const result = buildRoundResult(currentRoundState, horseMap)

    results.value = [...results.value, result]
    program.value = program.value.map((round, index) => {
      if (index === finishedRoundIndex) {
        return { ...round, status: "finished" }
      }
      return round
    })

    const winner = result.order[0]
    appendLog(
      `Round ${result.roundId} finished. Winner: ${winner.horseName} (${(winner.timeMs / 1000).toFixed(2)}s).`
    )

    activeRound.value = null
    isRunning.value = false
    isPaused.value = false

    if (results.value.length < program.value.length) {
      intermissionHandle.value = setTimeout(() => {
        start()
      }, INTERMISSION_MS)
    } else {
      appendLog("Championship complete. All 6 rounds finished.")
    }
  }

  function advanceBy(deltaMs) {
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

  function renderSnapshot() {
    const latestResult = results.value[results.value.length - 1] ?? null
    const mode = !hasProgram.value
      ? "idle"
      : activeRound.value
        ? isPaused.value
          ? "paused"
          : "racing"
        : isCompleted.value
          ? "finished"
          : "ready"

    const payload = {
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
