import { mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import RaceTrack from "~/components/RaceTrack.vue"
import { type Horse, type RoundState } from "~/utils/raceEngine"

const horses: Horse[] = [
  {
    id: "horse-1",
    name: "Crimson Arrow",
    color: "#ef4444",
    condition: 80,
    basePace: 13.7
  }
]

function createActiveRound(): RoundState {
  return {
    roundId: 1,
    distance: 1200,
    elapsedMs: 1_000,
    complete: false,
    entries: [
      {
        horseId: "horse-1",
        lane: 1,
        distanceCovered: 300,
        progress: 0.25,
        lastSpeed: 15.6,
        bestSpeed: 16.2,
        finishTimeMs: null
      }
    ]
  }
}

describe("RaceTrack", () => {
  beforeEach(() => {
    vi.stubGlobal("useRuntimeConfig", () => ({
      app: {
        baseURL: "/test-base/"
      }
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows idle state when there is no active round", () => {
    const wrapper = mount(RaceTrack, {
      props: {
        activeRound: null,
        horsesById: new Map(horses.map((horse) => [horse.id, horse])),
        isPaused: false
      }
    })

    expect(wrapper.text()).toContain("No race is active")
  })

  it("switches horse mask to standing art when paused", async () => {
    const wrapper = mount(RaceTrack, {
      props: {
        activeRound: createActiveRound(),
        horsesById: new Map(horses.map((horse) => [horse.id, horse])),
        isPaused: false
      }
    })

    const horseShape = wrapper.get(".horse-shape")
    expect(horseShape.attributes("style")).toContain("/test-base/images/running-horse-mask.apng")

    await wrapper.setProps({
      isPaused: true
    })

    expect(wrapper.get(".horse-shape").attributes("style")).toContain(
      "/test-base/images/running-horse-stand-mask.png"
    )
  })
})
