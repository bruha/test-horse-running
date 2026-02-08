import { describe, expect, it } from "vitest"
import { createHorseRaceStore, HORSE_RACE_MUTATIONS } from "~/store"
import { ROUND_STATUS, type RaceRound } from "~/utils/raceEngine"

describe("horseRaceStore", () => {
  it("resets state to initial values", () => {
    const store = createHorseRaceStore()

    const program: RaceRound[] = [
      {
        id: 1,
        distance: 1200,
        horseIds: ["horse-1"],
        status: ROUND_STATUS.PENDING
      }
    ]

    store.commit(HORSE_RACE_MUTATIONS.SET_SEED, 123)
    store.commit(HORSE_RACE_MUTATIONS.SET_PROGRAM, program)
    store.commit(HORSE_RACE_MUTATIONS.SET_IS_RUNNING, true)
    store.commit(HORSE_RACE_MUTATIONS.SET_EVENT_LOG, ["log line"])

    store.commit(HORSE_RACE_MUTATIONS.RESET_GAME_STATE)

    expect(store.state.seed).toBe(0)
    expect(store.state.program).toEqual([])
    expect(store.state.isRunning).toBe(false)
    expect(store.state.isPaused).toBe(false)
    expect(store.state.eventLog).toEqual([])
    expect(store.state.activeRound).toBeNull()
  })

  it("updates round status only when round index exists", () => {
    const store = createHorseRaceStore()

    const program: RaceRound[] = [
      {
        id: 1,
        distance: 1200,
        horseIds: ["horse-1", "horse-2"],
        status: ROUND_STATUS.PENDING
      }
    ]

    store.commit(HORSE_RACE_MUTATIONS.SET_PROGRAM, program)
    store.commit(HORSE_RACE_MUTATIONS.SET_ROUND_STATUS, {
      roundIndex: 0,
      status: ROUND_STATUS.RUNNING
    })

    expect(store.state.program[0]?.status).toBe(ROUND_STATUS.RUNNING)

    store.commit(HORSE_RACE_MUTATIONS.SET_ROUND_STATUS, {
      roundIndex: 4,
      status: ROUND_STATUS.FINISHED
    })

    expect(store.state.program).toHaveLength(1)
    expect(store.state.program[0]?.status).toBe(ROUND_STATUS.RUNNING)
  })
})
