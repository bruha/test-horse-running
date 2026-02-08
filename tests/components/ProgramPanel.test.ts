import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import ProgramPanel from "~/components/ProgramPanel.vue"
import { ROUND_STATUS, type Horse, type RaceRound } from "~/utils/raceEngine"

describe("ProgramPanel", () => {
  it("renders round status and participant names", () => {
    const horses: Horse[] = [
      {
        id: "horse-1",
        name: "Crimson Arrow",
        color: "#ef4444",
        condition: 80,
        basePace: 13.7
      },
      {
        id: "horse-2",
        name: "Silver Tempest",
        color: "#3b82f6",
        condition: 76,
        basePace: 13.3
      }
    ]

    const program: RaceRound[] = [
      {
        id: 1,
        distance: 1200,
        horseIds: ["horse-1", "horse-2"],
        status: ROUND_STATUS.RUNNING
      }
    ]

    const wrapper = mount(ProgramPanel, {
      props: {
        program,
        horsesById: new Map(horses.map((horse) => [horse.id, horse]))
      }
    })

    const row = wrapper.get("[data-testid='program-round']")

    expect(row.classes()).toContain("is-running")
    expect(wrapper.text()).toContain("Round 1")
    expect(wrapper.text()).toContain("Running")
    expect(wrapper.text()).toContain("Crimson Arrow, Silver Tempest")
  })
})
