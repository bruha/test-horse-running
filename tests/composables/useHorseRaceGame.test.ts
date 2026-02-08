import { createApp, h } from "vue"
import { describe, expect, it, vi } from "vitest"
import { useHorseRaceGame } from "~/composables/useHorseRaceGame"
import {
  createHorseRaceStore,
  HORSE_RACE_MUTATIONS,
  type HorseRaceStore,
  type HorseRaceStoreState
} from "~/store"
import { ROUND_STATUS, type RoundResult, type RoundState } from "~/utils/raceEngine"

type HorseRaceGame = ReturnType<typeof useHorseRaceGame>

interface GameHarness {
  game: HorseRaceGame
  store: HorseRaceStore
  unmount: () => void
}

function createGameHarness(): GameHarness {
  const store = createHorseRaceStore()
  let game: HorseRaceGame | undefined

  const app = createApp({
    setup() {
      game = useHorseRaceGame()
      return () => h("div")
    }
  })

  app.use(store)

  const target = document.createElement("div")
  document.body.appendChild(target)
  app.mount(target)

  if (!game) {
    throw new Error("Game harness failed to initialize")
  }

  return {
    game,
    store,
    unmount: () => {
      app.unmount()
      target.remove()
    }
  }
}

function forceCompleteRound(roundState: RoundState) {
  for (const entry of roundState.entries) {
    entry.distanceCovered = roundState.distance
    entry.progress = 1
    entry.lastSpeed = 16
    entry.bestSpeed = 16
    entry.finishTimeMs = 1_000 + entry.lane
  }
  roundState.complete = true
}

function createRoundResult(
  roundId: number,
  distance: number,
  orderedHorseIds: string[],
  storeState: HorseRaceStoreState,
  baseTimeMs: number
): RoundResult {
  return {
    roundId,
    distance,
    finishedAtMs: baseTimeMs,
    order: orderedHorseIds.map((horseId, index) => {
      const horse = storeState.horses.find((item) => item.id === horseId)

      if (!horse) {
        throw new Error(`Missing horse for result: ${horseId}`)
      }

      return {
        position: index + 1,
        horseId,
        horseName: horse.name,
        lane: index + 1,
        timeMs: baseTimeMs + index * 80,
        bestSpeed: 18 - index,
        condition: horse.condition
      }
    })
  }
}

describe("useHorseRaceGame orchestration", () => {
  it("pauses and resumes round progression correctly", () => {
    const harness = createGameHarness()

    try {
      const { game } = harness

      game.generateProgram(101)
      game.start()

      expect(game.activeRound.value).not.toBeNull()
      expect(game.isPaused.value).toBe(false)

      const beforeMove = game.activeRound.value!.entries[0]!.progress
      game.advanceBy(300)
      const afterMove = game.activeRound.value!.entries[0]!.progress

      expect(afterMove).toBeGreaterThan(beforeMove)

      game.togglePause()
      expect(game.isPaused.value).toBe(true)

      const pausedProgress = game.activeRound.value!.entries[0]!.progress
      game.advanceBy(5_000)

      expect(game.activeRound.value!.entries[0]!.progress).toBe(pausedProgress)

      game.togglePause()
      expect(game.isPaused.value).toBe(false)

      game.advanceBy(300)
      expect(game.activeRound.value!.entries[0]!.progress).toBeGreaterThan(pausedProgress)
    } finally {
      harness.game.resetGame()
      harness.unmount()
    }
  })

  it("starts next round after intermission delay", () => {
    vi.useFakeTimers()

    const harness = createGameHarness()

    try {
      const { game } = harness

      game.generateProgram(202)
      game.start()

      expect(game.activeRound.value?.roundId).toBe(1)

      forceCompleteRound(game.activeRound.value!)
      game.advanceBy(1)

      expect(game.results.value).toHaveLength(1)
      expect(game.activeRound.value).toBeNull()
      expect(game.isRunning.value).toBe(false)

      vi.advanceTimersByTime(899)
      expect(game.activeRound.value).toBeNull()

      vi.advanceTimersByTime(1)
      expect(game.activeRound.value?.roundId).toBe(2)
      expect(game.isRunning.value).toBe(true)
    } finally {
      harness.game.resetGame()
      harness.unmount()
      vi.useRealTimers()
    }
  })

  it("builds leaderboard from accumulated round results", () => {
    const harness = createGameHarness()

    try {
      const { game, store } = harness

      game.generateProgram(303)

      const [horseA, horseB, horseC] = game.horses.value.slice(0, 3)
      expect(horseA).toBeDefined()
      expect(horseB).toBeDefined()
      expect(horseC).toBeDefined()

      const roundOne = createRoundResult(
        1,
        1200,
        [horseA!.id, horseB!.id, horseC!.id],
        store.state,
        90_000
      )
      const roundTwo = createRoundResult(
        2,
        1400,
        [horseA!.id, horseB!.id, horseC!.id],
        store.state,
        96_000
      )

      store.commit(HORSE_RACE_MUTATIONS.SET_RESULTS, [roundOne, roundTwo])

      const leaderboard = game.leaderboard.value
      expect(leaderboard).not.toHaveLength(0)

      const leader = leaderboard[0]
      expect(leader?.horseId).toBe(horseA!.id)
      expect(leader?.wins).toBe(2)
      expect(leader?.podiums).toBe(2)
      expect(leader?.rounds).toBe(2)
      expect(leader?.points).toBe(10)
    } finally {
      harness.game.resetGame()
      harness.unmount()
    }
  })

  it("re-generates clean state while race is running", () => {
    const harness = createGameHarness()

    try {
      const { game } = harness

      game.generateProgram(404)
      game.start()
      game.advanceBy(300)

      expect(game.isRunning.value).toBe(true)
      expect(game.activeRound.value).not.toBeNull()

      game.generateProgram(505)

      expect(game.seed.value).toBe(505)
      expect(game.activeRound.value).toBeNull()
      expect(game.isRunning.value).toBe(false)
      expect(game.isPaused.value).toBe(false)
      expect(game.results.value).toHaveLength(0)
      expect(game.horses.value).toHaveLength(20)
      expect(game.program.value).toHaveLength(6)
      expect(game.program.value.every((round) => round.status === ROUND_STATUS.PENDING)).toBe(true)
      expect(game.eventLog.value[0]).toContain("Generated 20 horses")
    } finally {
      harness.game.resetGame()
      harness.unmount()
    }
  })
})
