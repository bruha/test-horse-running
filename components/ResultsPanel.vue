<script setup lang="ts">
import { type Horse, type RoundResult } from "~/utils/raceEngine"
import {
  HORSE_FALLBACK_COLOR,
  MILLISECONDS_IN_SECOND,
  RESULTS_EMPTY_MESSAGE
} from "~/utils/gameConstants"

const RESULT_TIME_DECIMALS = 2

const props = defineProps<{
  results: RoundResult[]
  horsesById: Map<string, Horse>
}>()

function horseColor(horseId: string): string {
  return props.horsesById.get(horseId)?.color ?? HORSE_FALLBACK_COLOR
}
</script>

<template>
  <section class="panel">
    <header class="panel-header">
      <h2>Results</h2>
      <p>Completed rounds in finish order</p>
    </header>

    <div v-if="results.length === 0" class="results-empty">{{ RESULTS_EMPTY_MESSAGE }}</div>

    <article
      v-for="result in results"
      v-else
      :key="result.roundId"
      class="result-card"
      data-testid="result-round"
    >
      <div class="result-title">
        <strong>Round {{ result.roundId }}</strong>
        <span>{{ result.distance }}m</span>
      </div>

      <ol class="result-order">
        <li
          v-for="entry in result.order"
          :key="`${result.roundId}-${entry.horseId}`"
          class="result-item"
        >
          <span class="rank">#{{ entry.position }}</span>
          <span class="color-dot" :style="{ backgroundColor: horseColor(entry.horseId) }" />
          <span class="name">{{ entry.horseName }}</span>
          <span class="time"
            >{{ (entry.timeMs / MILLISECONDS_IN_SECOND).toFixed(RESULT_TIME_DECIMALS) }}s</span
          >
        </li>
      </ol>
    </article>
  </section>
</template>

<style scoped>
.panel {
  background: rgba(2, 6, 23, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 20px;
  padding: 18px;
  backdrop-filter: blur(6px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.15rem;
}

.panel-header p {
  margin: 4px 0 0;
  color: rgba(226, 232, 240, 0.78);
  font-size: 0.84rem;
}

.results-empty {
  border: 1px dashed rgba(148, 163, 184, 0.45);
  border-radius: 14px;
  padding: 14px;
  font-size: 0.86rem;
  color: rgba(203, 213, 225, 0.9);
}

.result-card {
  border-radius: 14px;
  border: 1px solid rgba(34, 197, 94, 0.35);
  background: rgba(15, 23, 42, 0.92);
  padding: 10px 12px;
}

.result-title {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.result-title strong {
  font-size: 0.9rem;
}

.result-title span {
  font-size: 0.78rem;
  color: rgba(191, 219, 254, 0.95);
}

.result-order {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: grid;
  gap: 4px;
}

.result-item {
  display: grid;
  grid-template-columns: 30px 10px 1fr auto;
  gap: 8px;
  align-items: center;
  font-size: 0.8rem;
}

.rank {
  color: rgba(226, 232, 240, 0.95);
  font-variant-numeric: tabular-nums;
}

.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}

.name {
  color: rgba(248, 250, 252, 0.96);
}

.time {
  color: rgba(125, 211, 252, 0.95);
  font-variant-numeric: tabular-nums;
}
</style>
