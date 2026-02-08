<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue"
import ProgramPanel from "~/components/ProgramPanel.vue"
import RaceTrack from "~/components/RaceTrack.vue"
import ResultsPanel from "~/components/ResultsPanel.vue"

const LEADERBOARD_PREVIEW_COUNT = 5
const INITIAL_FRAME_REQUEST_ID = 0
const INITIAL_FRAME_TIMESTAMP = 0

declare global {
  interface Window {
    render_game_to_text?: () => string
    advanceTime?: (ms: number) => void | Promise<void>
  }
}

const game = useHorseRaceGame()

const {
  horses,
  program,
  results,
  activeRound,
  isPaused,
  hasProgram,
  isCompleted,
  canStart,
  canPause,
  canReset,
  eventLog,
  leaderboard,
  generateProgram,
  start,
  togglePause,
  advanceBy,
  resetGame,
  renderSnapshot
} = game

const horsesById = computed(() => new Map(horses.value.map((horse) => [horse.id, horse])))
const topLeaderboard = computed(() => leaderboard.value.slice(0, LEADERBOARD_PREVIEW_COUNT))

const statusLabel = computed(() => {
  if (!hasProgram.value) {
    return "Waiting for schedule generation"
  }
  if (activeRound.value && isPaused.value) {
    return `Round ${activeRound.value.roundId} paused`
  }
  if (activeRound.value) {
    return `Round ${activeRound.value.roundId} in progress`
  }
  if (isCompleted.value) {
    return "Championship complete"
  }
  return "Program ready to start"
})

let frameHandle = INITIAL_FRAME_REQUEST_ID
let lastFrame = INITIAL_FRAME_TIMESTAMP

const updateFrame = (timestamp) => {
  if (!lastFrame) {
    lastFrame = timestamp
  }
  if (document.hidden) {
    lastFrame = timestamp
    frameHandle = requestAnimationFrame(updateFrame)
    return
  }
  const delta = timestamp - lastFrame
  lastFrame = timestamp
  advanceBy(delta)
  frameHandle = requestAnimationFrame(updateFrame)
}

onMounted(() => {
  frameHandle = requestAnimationFrame(updateFrame)

  window.render_game_to_text = () => renderSnapshot()
  window.advanceTime = async (ms) => {
    advanceBy(ms)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frameHandle)
  if (window.render_game_to_text) {
    delete window.render_game_to_text
  }
  if (window.advanceTime) {
    delete window.advanceTime
  }
})
</script>

<template>
  <main class="app">
    <div class="backdrop-aurora" />
    <div class="backdrop-grid" />

    <header class="hero">
      <h1>Horse Racing Trial Day</h1>
      <p>
        Local front-end race simulator built with Nuxt 4. Fixed pool of 20 horses, 6 rounds, and
        live track animation.
      </p>
    </header>

    <section class="controls">
      <button type="button" class="btn btn-accent" @click="generateProgram()">
        Generate Program
      </button>
      <button type="button" class="btn" :disabled="!canStart" @click="start()">Start</button>
      <button type="button" class="btn" :disabled="!canPause" @click="togglePause()">
        {{ isPaused ? "Resume" : "Pause" }}
      </button>
      <button type="button" class="btn" :disabled="!canReset" @click="resetGame()">Reset</button>

      <div class="status">
        <span class="status-label">Status</span>
        <strong>{{ statusLabel }}</strong>
      </div>
    </section>

    <section class="layout">
      <ProgramPanel :program="program" :horses-by-id="horsesById" />
      <RaceTrack :active-round="activeRound" :horses-by-id="horsesById" :is-paused="isPaused" />
      <ResultsPanel :results="results" :horses-by-id="horsesById" />
    </section>

    <section class="stats-grid">
      <article class="card">
        <h3>Top Ranking</h3>
        <p class="card-copy">Points aggregate all completed rounds (5/3/2 points for top 3).</p>
        <ol v-if="topLeaderboard.length" class="ranking-list">
          <li v-for="entry in topLeaderboard" :key="entry.horseId">
            <span class="dot" :style="{ backgroundColor: entry.color }" />
            <strong>{{ entry.name }}</strong>
            <span>{{ entry.points }} pts</span>
          </li>
        </ol>
        <p v-else class="empty">No ranking yet.</p>
      </article>

      <article class="card">
        <h3>Horse Roster</h3>
        <p class="card-copy">
          Condition score range is 1-100 and impacts speed every simulation tick.
        </p>
        <div class="roster-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Condition</th>
                <th>Base Pace</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="horse in horses" :key="horse.id" data-testid="horse-row">
                <td>
                  <span class="dot" :style="{ backgroundColor: horse.color }" />
                  {{ horse.name }}
                </td>
                <td>{{ horse.condition }}</td>
                <td>{{ horse.basePace.toFixed(2) }} m/s</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="card">
        <h3>Race Log</h3>
        <p class="card-copy">
          Sequential event stream for starts, finishes, pause/resume, and completion.
        </p>
        <ul v-if="eventLog.length" class="log-list">
          <li v-for="line in eventLog" :key="line">{{ line }}</li>
        </ul>
        <p v-else class="empty">No events yet.</p>
      </article>
    </section>
  </main>
</template>

<style scoped>
:global(body) {
  margin: 0;
  background: #020617;
  color: #f8fafc;
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
}

:global(*) {
  box-sizing: border-box;
}

.app {
  position: relative;
  min-height: 100vh;
  padding: 24px 18px 40px;
  overflow: hidden;
}

.backdrop-aurora {
  position: fixed;
  inset: -30% -10% auto;
  height: 72vh;
  pointer-events: none;
  background:
    radial-gradient(circle at 14% 28%, rgba(14, 165, 233, 0.24), transparent 38%),
    radial-gradient(circle at 78% 12%, rgba(34, 197, 94, 0.22), transparent 34%),
    radial-gradient(circle at 66% 70%, rgba(249, 115, 22, 0.18), transparent 38%);
  filter: blur(30px);
  z-index: 0;
}

.backdrop-grid {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.24;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.16) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.14) 1px, transparent 1px);
  background-size: 42px 42px;
}

.hero,
.controls,
.layout,
.stats-grid {
  position: relative;
  z-index: 1;
  max-width: 1480px;
  margin: 0 auto;
}

.hero h1 {
  margin: 0;
  font-family: "Rockwell", "Georgia", serif;
  letter-spacing: 0.02em;
  font-size: clamp(2rem, 3.1vw, 3rem);
}

.hero p {
  margin: 10px 0 0;
  max-width: 900px;
  color: rgba(226, 232, 240, 0.86);
  font-size: 1rem;
  line-height: 1.45;
}

.controls {
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.btn {
  border: 1px solid rgba(148, 163, 184, 0.42);
  background: rgba(15, 23, 42, 0.88);
  color: #f8fafc;
  padding: 10px 14px;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 120ms ease,
    border-color 120ms ease;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(125, 211, 252, 0.78);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-accent {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.92), rgba(6, 182, 212, 0.86));
  border-color: rgba(103, 232, 249, 0.5);
}

.status {
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 12px;
  padding: 8px 12px;
  background: rgba(15, 23, 42, 0.72);
}

.status-label {
  display: block;
  font-size: 0.67rem;
  color: rgba(148, 163, 184, 0.95);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.status strong {
  font-size: 0.9rem;
}

.layout {
  margin-top: 20px;
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(460px, 1.8fr) minmax(280px, 1fr);
  gap: 12px;
}

.stats-grid {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  gap: 12px;
}

.card {
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(2, 6, 23, 0.8);
  padding: 14px;
}

.card h3 {
  margin: 0;
  font-size: 1rem;
}

.card-copy {
  margin: 6px 0 10px;
  color: rgba(203, 213, 225, 0.88);
  font-size: 0.82rem;
  line-height: 1.35;
}

.ranking-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.ranking-list li {
  display: grid;
  grid-template-columns: 10px 1fr auto;
  gap: 8px;
  align-items: center;
  font-size: 0.84rem;
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  margin-right: 8px;
}

.roster-table-wrap {
  max-height: 260px;
  overflow: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

thead th {
  text-align: left;
  color: rgba(191, 219, 254, 0.95);
  font-size: 0.74rem;
  font-weight: 700;
  padding-bottom: 6px;
}

tbody tr + tr {
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

tbody td {
  padding: 6px 0;
  font-variant-numeric: tabular-nums;
}

.log-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 5px;
  font-size: 0.78rem;
  color: rgba(226, 232, 240, 0.93);
}

.empty {
  margin: 0;
  color: rgba(148, 163, 184, 0.95);
  font-size: 0.82rem;
}

@media (max-width: 1280px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
