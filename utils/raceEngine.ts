import { MILLISECONDS_IN_SECOND } from "./gameConstants.ts"

export const ROUND_DISTANCES = [1200, 1400, 1600, 1800, 2000, 2200] as const
export const DEFAULT_HORSE_COUNT = 20
export const HORSES_PER_ROUND = 10

export const ROUND_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  FINISHED: "finished"
} as const

export type RoundStatus = (typeof ROUND_STATUS)[keyof typeof ROUND_STATUS]
export type RandomSource = () => number

export interface Horse {
  id: string
  name: string
  color: string
  condition: number
  basePace: number
}

export interface RaceRound {
  id: number
  distance: number
  horseIds: string[]
  status: RoundStatus
}

export interface RaceRoundDefinition {
  id: number
  distance: number
  horseIds: string[]
  status?: RoundStatus
}

export interface RoundEntry {
  horseId: string
  lane: number
  distanceCovered: number
  progress: number
  lastSpeed: number
  bestSpeed: number
  finishTimeMs: number | null
}

export interface RoundState {
  roundId: number
  distance: number
  elapsedMs: number
  entries: RoundEntry[]
  complete: boolean
}

export interface RoundResultItem {
  position: number
  horseId: string
  horseName: string
  lane: number
  timeMs: number
  bestSpeed: number
  condition: number
}

export interface RoundResult {
  roundId: number
  distance: number
  finishedAtMs: number
  order: RoundResultItem[]
}

export type HorseMap = Map<string, Horse>

const HORSE_NAME_POOL = [
  "Crimson Arrow",
  "Northern Comet",
  "Silver Tempest",
  "Amber Quill",
  "Iron Echo",
  "Midnight Orbit",
  "Wild Sonata",
  "Ivory Rider",
  "Emerald Fuse",
  "Blue Monarch",
  "Rapid Lantern",
  "Golden Crest",
  "Velvet Falcon",
  "Storm Herald",
  "Arctic Flame",
  "Violet Signal",
  "Echo Mirage",
  "Dusty Nova",
  "Scarlet Cipher",
  "Cloud Voyager",
  "Ruby Atlas",
  "Cinder Pulse",
  "Frost Cardinal",
  "Titan Comet",
  "Lunar Horizon",
  "Copper Zephyr",
  "Night Atlas",
  "Solar Rally",
  "Royal Drift",
  "Mystic Rivet",
  "Granite Saber",
  "Quartz Runner",
  "Cobalt Aurora",
  "Dune Prophet",
  "Ivory Titan",
  "Crimson Vega",
  "Jade Voltage",
  "Neon Crusader",
  "Prairie Echo",
  "Opal Jet"
]

export const HORSE_COLOR_PALETTE = [
  "#e81717",
  "#ec713c",
  "#e89417",
  "#ecda3c",
  "#bee817",
  "#94ec3c",
  "#41e817",
  "#3cec4e",
  "#17e86b",
  "#3cecb7",
  "#17e8e8",
  "#3cb7ec",
  "#176be8",
  "#3c4eec",
  "#4117e8",
  "#943cec",
  "#be17e8",
  "#ec3cda",
  "#e81794",
  "#ec3c71"
]

const RNG_MODULUS = 2_147_483_647
const RNG_MULTIPLIER = 48_271
const RNG_MINIMUM_NON_ZERO_SEED = 1

const CONDITION_MIN = 1
const CONDITION_MAX = 100
const BASE_PACE_MIN = 12
const BASE_PACE_CONDITION_SCALE = 0.07
const BASE_PACE_RANDOM_SPREAD = 2.2

const CONDITION_MULTIPLIER_BASE = 0.78
const CONDITION_MULTIPLIER_SCALE = 100
const RANDOM_PULSE_BASE = 0.9
const RANDOM_PULSE_RANGE = 0.25
const FATIGUE_MAX_PENALTY = 0.2
const LATE_BOOST_TRIGGER_PROGRESS = 0.82
const LATE_BOOST_BASE = 1.05
const LATE_BOOST_RANGE = 0.08
const MINIMUM_SPEED_MPS = 4.2

const MAX_SIMULATION_DURATION_MS = 600_000

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function createSeededRng(seed: number = Date.now()): RandomSource {
  const normalizedSeed = Math.floor(Math.abs(seed))
  let state = normalizedSeed % RNG_MODULUS

  if (state === 0) {
    state = RNG_MINIMUM_NON_ZERO_SEED
  }

  return () => {
    state = (state * RNG_MULTIPLIER) % RNG_MODULUS
    return (state - 1) / (RNG_MODULUS - 1)
  }
}

export function randomInt(min: number, max: number, rng: RandomSource = Math.random): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function shuffle<T>(items: readonly T[], rng: RandomSource = Math.random): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

function sample<T>(items: readonly T[], count: number, rng: RandomSource = Math.random): T[] {
  invariant(count <= items.length, `Cannot sample ${count} items from ${items.length}`)
  return shuffle(items, rng).slice(0, count)
}

export function createHorsePool(count: number = DEFAULT_HORSE_COUNT, rng: RandomSource = Math.random): Horse[] {
  invariant(count > 0, "Horse count must be greater than zero")
  invariant(count <= HORSE_NAME_POOL.length, "Horse count exceeds available unique names")
  invariant(count <= HORSE_COLOR_PALETTE.length, "Horse count exceeds available predefined colors")

  const names = sample(HORSE_NAME_POOL, count, rng)
  const colors = sample(HORSE_COLOR_PALETTE, count, rng)

  return names.map((name, index) => {
    const condition = randomInt(CONDITION_MIN, CONDITION_MAX, rng)
    const color = colors[index]
    const basePace = Number(
      (BASE_PACE_MIN + condition * BASE_PACE_CONDITION_SCALE + rng() * BASE_PACE_RANDOM_SPREAD).toFixed(2)
    )

    return {
      id: `horse-${index + 1}`,
      name,
      color,
      condition,
      basePace
    }
  })
}

export function buildRaceSchedule(horses: Horse[], rng: RandomSource = Math.random): RaceRound[] {
  invariant(Array.isArray(horses) && horses.length >= HORSES_PER_ROUND, "At least 10 horses are required")
  const horseIds = horses.map((horse) => horse.id)

  return ROUND_DISTANCES.map((distance, roundIndex) => ({
    id: roundIndex + 1,
    distance,
    horseIds: sample(horseIds, HORSES_PER_ROUND, rng),
    status: ROUND_STATUS.PENDING
  }))
}

export function createHorseMap(horses: Horse[]): HorseMap {
  return new Map(horses.map((horse) => [horse.id, horse]))
}

export function createRoundState(round: RaceRoundDefinition, horseMap: HorseMap): RoundState {
  const entries = round.horseIds.map((horseId, index) => {
    const horse = horseMap.get(horseId)
    invariant(Boolean(horse), `Horse ${horseId} was not found in the horse map`)

    return {
      horseId,
      lane: index + 1,
      distanceCovered: 0,
      progress: 0,
      lastSpeed: 0,
      bestSpeed: 0,
      finishTimeMs: null
    }
  })

  return {
    roundId: round.id,
    distance: round.distance,
    elapsedMs: 0,
    entries,
    complete: false
  }
}

function calculateSpeedMetersPerSecond(
  horse: Horse,
  entry: RoundEntry,
  roundDistance: number,
  rng: RandomSource = Math.random
): number {
  const progressRatio = entry.distanceCovered / roundDistance
  const conditionMultiplier = CONDITION_MULTIPLIER_BASE + horse.condition / CONDITION_MULTIPLIER_SCALE
  const randomPulse = RANDOM_PULSE_BASE + rng() * RANDOM_PULSE_RANGE
  const fatigue = 1 - progressRatio * FATIGUE_MAX_PENALTY
  const lateBoost =
    progressRatio > LATE_BOOST_TRIGGER_PROGRESS ? LATE_BOOST_BASE + rng() * LATE_BOOST_RANGE : 1
  const pace = horse.basePace * conditionMultiplier * randomPulse * fatigue * lateBoost

  return Math.max(MINIMUM_SPEED_MPS, pace)
}

export function stepRound(
  roundState: RoundState,
  deltaMs: number,
  horseMap: HorseMap,
  rng: RandomSource = Math.random
): RoundState {
  if (roundState.complete || deltaMs <= 0) {
    return roundState
  }

  const deltaSeconds = deltaMs / MILLISECONDS_IN_SECOND

  for (const entry of roundState.entries) {
    if (entry.finishTimeMs !== null) {
      continue
    }

    const horse = horseMap.get(entry.horseId)
    invariant(Boolean(horse), `Horse ${entry.horseId} was not found in the horse map`)

    const speed = calculateSpeedMetersPerSecond(horse, entry, roundState.distance, rng)
    const distanceDelta = speed * deltaSeconds
    const tentativeDistance = entry.distanceCovered + distanceDelta
    const clampedDistance = Math.min(roundState.distance, tentativeDistance)
    const progress = clampedDistance / roundState.distance

    entry.distanceCovered = clampedDistance
    entry.progress = Math.min(1, progress)
    entry.lastSpeed = Number(speed.toFixed(2))
    entry.bestSpeed = Math.max(entry.bestSpeed, entry.lastSpeed)

    if (clampedDistance >= roundState.distance && entry.finishTimeMs === null) {
      const overshootDistance = Math.max(0, tentativeDistance - roundState.distance)
      const overshootMs = speed > 0 ? (overshootDistance / speed) * MILLISECONDS_IN_SECOND : 0
      entry.finishTimeMs = Number((roundState.elapsedMs + deltaMs - overshootMs).toFixed(2))
    }
  }

  roundState.elapsedMs = Number((roundState.elapsedMs + deltaMs).toFixed(2))
  roundState.complete = roundState.entries.every((entry) => entry.finishTimeMs !== null)

  return roundState
}

export function isRoundComplete(roundState: RoundState): boolean {
  return roundState.entries.every((entry) => entry.finishTimeMs !== null)
}

export function getRoundRanking(roundState: RoundState): RoundEntry[] {
  return [...roundState.entries].sort((left, right) => {
    const leftTime = left.finishTimeMs ?? Number.POSITIVE_INFINITY
    const rightTime = right.finishTimeMs ?? Number.POSITIVE_INFINITY

    if (leftTime !== rightTime) {
      return leftTime - rightTime
    }
    if (left.distanceCovered !== right.distanceCovered) {
      return right.distanceCovered - left.distanceCovered
    }

    return left.lane - right.lane
  })
}

export function buildRoundResult(roundState: RoundState, horseMap: HorseMap): RoundResult {
  const ranking = getRoundRanking(roundState)

  return {
    roundId: roundState.roundId,
    distance: roundState.distance,
    finishedAtMs: roundState.elapsedMs,
    order: ranking.map((entry, index) => {
      const horse = horseMap.get(entry.horseId)
      invariant(Boolean(horse), `Horse ${entry.horseId} was not found in the horse map`)

      return {
        position: index + 1,
        horseId: entry.horseId,
        horseName: horse.name,
        lane: entry.lane,
        timeMs: Number((entry.finishTimeMs ?? roundState.elapsedMs).toFixed(2)),
        bestSpeed: Number(entry.bestSpeed.toFixed(2)),
        condition: horse.condition
      }
    })
  }
}

export function simulateRound(
  round: RaceRoundDefinition,
  horseMap: HorseMap,
  rng: RandomSource = Math.random,
  stepMs = 80
): RoundResult {
  const roundState = createRoundState(round, horseMap)

  while (!roundState.complete && roundState.elapsedMs < MAX_SIMULATION_DURATION_MS) {
    stepRound(roundState, stepMs, horseMap, rng)
  }

  invariant(roundState.complete, "Round simulation timed out")
  return buildRoundResult(roundState, horseMap)
}
