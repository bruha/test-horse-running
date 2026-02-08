const { test, expect } = require("@playwright/test")

test("game flow: generate, start, pause, resume, and receive results", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Horse Racing Trial Day" })).toBeVisible()
  await page.getByRole("button", { name: "Generate Program" }).click()

  await expect(page.locator("[data-testid='program-round']")).toHaveCount(6)
  await expect(page.locator("[data-testid='horse-row']")).toHaveCount(20)
  await expect(page.getByText("20 horses loaded")).toBeVisible()

  await page.getByRole("button", { name: "Start" }).click()
  await expect(page.getByText(/Round 1 in progress/i)).toBeVisible()

  const firstHorseToken = page.locator("[data-testid='horse-token']").first()
  await expect(firstHorseToken).toBeVisible()

  const currentProgress = async () =>
    Number(await firstHorseToken.getAttribute("data-progress"))

  await page.waitForTimeout(400)
  const beforeMove = await currentProgress()
  await page.waitForTimeout(500)
  const afterMove = await currentProgress()
  expect(afterMove).toBeGreaterThan(beforeMove + 0.03)

  await page.getByRole("button", { name: "Pause" }).click()
  await expect(page.locator(".badge.paused")).toBeVisible()

  await page.waitForTimeout(700)
  const pausedA = await currentProgress()
  await page.waitForTimeout(700)
  const pausedB = await currentProgress()
  expect(Math.abs(pausedB - pausedA)).toBeLessThan(0.005)

  await page.getByRole("button", { name: "Resume" }).click()
  await expect(page.locator("[data-testid='result-round']").first()).toBeVisible({ timeout: 20_000 })
})
