import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import ResultsPanel from "~/components/ResultsPanel.vue"
import { type Horse, type RoundResult } from "~/utils/raceEngine"

describe("ResultsPanel", () => {
  it("shows empty-state message when there are no results", () => {
    const wrapper = mount(ResultsPanel, {
      props: {
        results: [],
        horsesById: new Map()
      }
    })

    expect(wrapper.text()).toContain("Race results will appear after each round.")
  })

  it("renders race results with formatted times", () => {
    const horses: Horse[] = [
      {
        id: "horse-1",
        name: "Crimson Arrow",
        color: "#ef4444",
        condition: 80,
        basePace: 13.7
      }
    ]

    const results: RoundResult[] = [
      {
        roundId: 1,
        distance: 1200,
        finishedAtMs: 91_000,
        order: [
          {
            position: 1,
            horseId: "horse-1",
            horseName: "Crimson Arrow",
            lane: 1,
            timeMs: 91_000,
            bestSpeed: 18.5,
            condition: 80
          }
        ]
      }
    ]

    const wrapper = mount(ResultsPanel, {
      props: {
        results,
        horsesById: new Map(horses.map((horse) => [horse.id, horse]))
      }
    })

    expect(wrapper.findAll("[data-testid='result-round']")).toHaveLength(1)
    expect(wrapper.text()).toContain("Round 1")
    expect(wrapper.text()).toContain("91.00s")
  })
})
