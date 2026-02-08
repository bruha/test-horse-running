import { createStore, type Store } from "vuex"
import { type Horse, type RaceRound, type RoundResult, type RoundState, type RoundStatus } from "~/utils/raceEngine"

export interface HorseRaceStoreState {
  horses: Horse[]
  program: RaceRound[]
  results: RoundResult[]
  activeRound: RoundState | null
  isRunning: boolean
  isPaused: boolean
  eventLog: string[]
  seed: number
}

interface SetRoundStatusPayload {
  roundIndex: number
  status: RoundStatus
}

export const HORSE_RACE_MUTATIONS = {
  RESET_GAME_STATE: "resetGameState",
  SET_HORSES: "setHorses",
  SET_PROGRAM: "setProgram",
  SET_RESULTS: "setResults",
  SET_ACTIVE_ROUND: "setActiveRound",
  SET_IS_RUNNING: "setIsRunning",
  SET_IS_PAUSED: "setIsPaused",
  SET_EVENT_LOG: "setEventLog",
  SET_SEED: "setSeed",
  SET_ROUND_STATUS: "setRoundStatus"
} as const

function createInitialState(): HorseRaceStoreState {
  return {
    horses: [],
    program: [],
    results: [],
    activeRound: null,
    isRunning: false,
    isPaused: false,
    eventLog: [],
    seed: 0
  }
}

export const horseRaceStore = createStore<HorseRaceStoreState>({
  state: createInitialState,
  mutations: {
    [HORSE_RACE_MUTATIONS.RESET_GAME_STATE](state) {
      Object.assign(state, createInitialState())
    },
    [HORSE_RACE_MUTATIONS.SET_HORSES](state, horses: Horse[]) {
      state.horses = horses
    },
    [HORSE_RACE_MUTATIONS.SET_PROGRAM](state, program: RaceRound[]) {
      state.program = program
    },
    [HORSE_RACE_MUTATIONS.SET_RESULTS](state, results: RoundResult[]) {
      state.results = results
    },
    [HORSE_RACE_MUTATIONS.SET_ACTIVE_ROUND](state, activeRound: RoundState | null) {
      state.activeRound = activeRound
    },
    [HORSE_RACE_MUTATIONS.SET_IS_RUNNING](state, isRunning: boolean) {
      state.isRunning = isRunning
    },
    [HORSE_RACE_MUTATIONS.SET_IS_PAUSED](state, isPaused: boolean) {
      state.isPaused = isPaused
    },
    [HORSE_RACE_MUTATIONS.SET_EVENT_LOG](state, eventLog: string[]) {
      state.eventLog = eventLog
    },
    [HORSE_RACE_MUTATIONS.SET_SEED](state, seed: number) {
      state.seed = seed
    },
    [HORSE_RACE_MUTATIONS.SET_ROUND_STATUS](state, payload: SetRoundStatusPayload) {
      const round = state.program[payload.roundIndex]
      if (!round) {
        return
      }
      round.status = payload.status
    }
  }
})

export type HorseRaceStore = Store<HorseRaceStoreState>
