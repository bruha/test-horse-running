import assert from "node:assert/strict"
import test from "node:test"
import {
  createSeededRng,
  createHorsePool,
  buildRaceSchedule,
  createHorseMap,
  createRoundState,
  stepRound,
  simulateRound
} from "../../utils/raceEngine.ts"

test("createHorsePool returns expected horse count with unique names", () => {
  const rng = createSeededRng(42)
  const horses = createHorsePool(20, rng)

  assert.equal(horses.length, 20)

  const uniqueNames = new Set(horses.map((horse) => horse.name))
  assert.equal(uniqueNames.size, 20)

  const uniqueColors = new Set(horses.map((horse) => horse.color))
  assert.equal(uniqueColors.size, 20)

  for (const horse of horses) {
    assert.ok(horse.condition >= 1 && horse.condition <= 100)
    assert.ok(horse.basePace > 0)
    assert.match(horse.color, /^#[0-9a-f]{6}$/i)
  }
})

test("buildRaceSchedule returns expected rounds and horses per round", () => {
  const rng = createSeededRng(1204)
  const horses = createHorsePool(20, rng)
  const schedule = buildRaceSchedule(horses, rng)

  assert.equal(schedule.length, 6)
  assert.deepEqual(
    schedule.map((round) => round.distance),
    [1200, 1400, 1600, 1800, 2000, 2200]
  )

  for (const round of schedule) {
    assert.equal(round.horseIds.length, 10)
    assert.equal(new Set(round.horseIds).size, 10)
    for (const horseId of round.horseIds) {
      assert.ok(horses.some((horse) => horse.id === horseId))
    }
  }
})

test("stepRound keeps progress in range and eventually finishes", () => {
  const rng = createSeededRng(7)
  const horses = createHorsePool(20, rng)
  const map = createHorseMap(horses)
  const round = buildRaceSchedule(horses, rng)[0]
  const state = createRoundState(round, map)

  for (let tick = 0; tick < 5000 && !state.complete; tick += 1) {
    stepRound(state, 200, map, rng)
    for (const entry of state.entries) {
      assert.ok(entry.progress >= 0 && entry.progress <= 1)
      assert.ok(entry.distanceCovered >= 0 && entry.distanceCovered <= round.distance)
    }
  }

  assert.equal(state.complete, true)
})

test("higher condition horse consistently beats lower condition horse over repeated races", () => {
  let higherConditionWins = 0

  for (let i = 0; i < 20; i += 1) {
    const rng = createSeededRng(500 + i)
    const horses = [
      {
        id: "horse-high",
        name: "High",
        color: "#10b981",
        condition: 95,
        basePace: 15
      },
      {
        id: "horse-low",
        name: "Low",
        color: "#ef4444",
        condition: 20,
        basePace: 15
      }
    ]

    const result = simulateRound(
      {
        id: 1,
        distance: 1400,
        horseIds: ["horse-high", "horse-low"],
        status: "pending"
      },
      createHorseMap(horses),
      rng,
      60
    )

    if (result.order[0]?.horseId === "horse-high") {
      higherConditionWins += 1
    }
  }

  assert.ok(higherConditionWins >= 17)
})
