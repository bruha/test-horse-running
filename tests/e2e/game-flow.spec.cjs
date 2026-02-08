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

  const currentLeft = async () =>
    Number(await firstHorseToken.evaluate((element) => parseFloat(element.style.left || "0")))

  await page.waitForTimeout(400)
  const beforeMove = await currentLeft()
  await page.waitForTimeout(500)
  const afterMove = await currentLeft()
  expect(afterMove).toBeGreaterThan(beforeMove + 0.2)

  await page.getByRole("button", { name: "Pause" }).click()
  await expect(page.locator(".badge.paused")).toBeVisible()

  await page.waitForTimeout(700)
  const pausedA = await currentLeft()
  await page.waitForTimeout(700)
  const pausedB = await currentLeft()
  expect(Math.abs(pausedB - pausedA)).toBeLessThan(0.2)

  await page.getByRole("button", { name: "Resume" }).click()
  await expect(page.locator("[data-testid='result-round']").first()).toBeVisible({ timeout: 20_000 })
})
