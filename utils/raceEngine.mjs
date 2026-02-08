export const ROUND_DISTANCES = Object.freeze([1200, 1400, 1600, 1800, 2000, 2200])
export const DEFAULT_HORSE_COUNT = 20
export const HORSES_PER_ROUND = 10

const HORSE_NAME_POOL = Object.freeze([
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
])

export const HORSE_COLOR_PALETTE = Object.freeze([
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
])

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

export function createSeededRng(seed = Date.now()) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

export function randomInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function shuffle(items, rng = Math.random) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

function sample(items, count, rng = Math.random) {
  invariant(count <= items.length, `Cannot sample ${count} items from ${items.length}`)
  return shuffle(items, rng).slice(0, count)
}

export function createHorsePool(count = DEFAULT_HORSE_COUNT, rng = Math.random) {
  invariant(count > 0, "Horse count must be greater than zero")
  invariant(count <= HORSE_NAME_POOL.length, "Horse count exceeds available unique names")
  invariant(count <= HORSE_COLOR_PALETTE.length, "Horse count exceeds available predefined colors")

  const names = sample(HORSE_NAME_POOL, count, rng)
  const colors = sample(HORSE_COLOR_PALETTE, count, rng)

  return names.map((name, index) => {
    const condition = randomInt(1, 100, rng)
    const color = colors[index]
    const basePace = Number((12 + condition * 0.07 + rng() * 2.2).toFixed(2))

    return {
      id: `horse-${index + 1}`,
      name,
      color,
      condition,
      basePace
    }
  })
}

export function buildRaceSchedule(horses, rng = Math.random) {
  invariant(Array.isArray(horses) && horses.length >= HORSES_PER_ROUND, "At least 10 horses are required")
  const horseIds = horses.map((horse) => horse.id)

  return ROUND_DISTANCES.map((distance, roundIndex) => ({
    id: roundIndex + 1,
    distance,
    horseIds: sample(horseIds, HORSES_PER_ROUND, rng),
    status: "pending"
  }))
}

export function createHorseMap(horses) {
  return new Map(horses.map((horse) => [horse.id, horse]))
}

export function createRoundState(round, horseMap) {
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

function calculateSpeedMetersPerSecond(horse, entry, roundDistance, rng = Math.random) {
  const progressRatio = entry.distanceCovered / roundDistance
  const conditionMultiplier = 0.78 + horse.condition / 100
  const randomPulse = 0.9 + rng() * 0.25
  const fatigue = 1 - progressRatio * 0.2
  const lateBoost = progressRatio > 0.82 ? 1.05 + rng() * 0.08 : 1
  const pace = horse.basePace * conditionMultiplier * randomPulse * fatigue * lateBoost
  return Math.max(4.2, pace)
}

export function stepRound(roundState, deltaMs, horseMap, rng = Math.random) {
  if (roundState.complete || deltaMs <= 0) {
    return roundState
  }

  const deltaSeconds = deltaMs / 1000

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
      const overshootMs = speed > 0 ? (overshootDistance / speed) * 1000 : 0
      entry.finishTimeMs = Number((roundState.elapsedMs + deltaMs - overshootMs).toFixed(2))
    }
  }

  roundState.elapsedMs = Number((roundState.elapsedMs + deltaMs).toFixed(2))
  roundState.complete = roundState.entries.every((entry) => entry.finishTimeMs !== null)
  return roundState
}

export function isRoundComplete(roundState) {
  return roundState.entries.every((entry) => entry.finishTimeMs !== null)
}

export function getRoundRanking(roundState) {
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

export function buildRoundResult(roundState, horseMap) {
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

export function simulateRound(round, horseMap, rng = Math.random, stepMs = 80) {
  const roundState = createRoundState(round, horseMap)
  const maxSimulationMs = 600_000

  while (!roundState.complete && roundState.elapsedMs < maxSimulationMs) {
    stepRound(roundState, stepMs, horseMap, rng)
  }

  invariant(roundState.complete, "Round simulation timed out")
  return buildRoundResult(roundState, horseMap)
}
