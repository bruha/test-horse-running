<script setup lang="ts">
import { computed } from "vue"
import { type Horse, type RoundEntry, type RoundState } from "~/utils/raceEngine"

const DEFAULT_HORSE_COLOR = "#9ca3af"
const HORSE_MASK_ASSET = "/images/running-horse-mask.apng"
const HORSE_STAND_MASK_ASSET = "/images/running-horse-stand-mask.png"
const TRACK_PROGRESS_MIN = 0
const TRACK_PROGRESS_MAX = 1

const props = defineProps<{
  activeRound: RoundState | null
  horsesById: Map<string, Horse>
  isPaused: boolean
}>()

const markers = [0, 25, 50, 75, 100]

const roundLabel = computed(() => {
  if (!props.activeRound) {
    return "No race is active"
  }
  return `Round ${props.activeRound.roundId} • ${props.activeRound.distance}m`
})

function horseColor(entry: RoundEntry): string {
  return props.horsesById.get(entry.horseId)?.color ?? DEFAULT_HORSE_COLOR
}

function horseMaskSrc(entry: RoundEntry): string {
  const isStopped = props.isPaused || entry.finishTimeMs !== null
  return isStopped ? HORSE_STAND_MASK_ASSET : HORSE_MASK_ASSET
}
</script>

<template>
  <section class="track-panel">
    <header class="track-header">
      <h2>Track</h2>
      <p>{{ roundLabel }}</p>
      <span v-if="activeRound && isPaused" class="badge paused">Paused</span>
      <span v-else-if="activeRound" class="badge live">Live</span>
    </header>

    <div v-if="!activeRound" class="track-empty">
      Generate program and press Start to launch races.
    </div>

    <div v-else class="track-grid">
      <div class="track-ruler">
        <span v-for="marker in markers" :key="marker">{{ marker }}%</span>
      </div>

      <div
        v-for="entry in activeRound.entries"
        :key="entry.horseId"
        class="lane"
      >
        <span class="lane-id">L{{ entry.lane }}</span>
        <div class="lane-track">
          <div
            class="horse-token"
            data-testid="horse-token"
            :data-progress="entry.progress.toFixed(4)"
            :style="{
              '--progress': Math.min(TRACK_PROGRESS_MAX, Math.max(TRACK_PROGRESS_MIN, entry.progress)).toFixed(4)
            }"
          >
            <div class="horse-art" aria-hidden="true">
              <div
                class="horse-shape"
                :style="{
                  '--horse-color': horseColor(entry),
                  '--horse-mask': `url('${horseMaskSrc(entry)}')`
                }"
              />
            </div>
            <div class="horse-meta">
              <strong>{{ horsesById.get(entry.horseId)?.name ?? entry.horseId }}</strong>
              <small>{{ entry.lastSpeed.toFixed(1) }} m/s</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.track-panel {
  background: linear-gradient(165deg, rgba(5, 150, 105, 0.16), rgba(2, 6, 23, 0.86));
  border: 1px solid rgba(148, 163, 184, 0.26);
  border-radius: 20px;
  padding: 18px;
  min-height: 560px;
  backdrop-filter: blur(6px);
}

.track-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.track-header h2 {
  margin: 0;
  font-size: 1.15rem;
}

.track-header p {
  margin: 0;
  color: rgba(226, 232, 240, 0.85);
  font-size: 0.86rem;
}

.badge {
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 0.72rem;
  border: 1px solid transparent;
}

.badge.live {
  background: rgba(59, 130, 246, 0.16);
  color: rgba(147, 197, 253, 1);
  border-color: rgba(59, 130, 246, 0.46);
}

.badge.paused {
  background: rgba(249, 115, 22, 0.16);
  color: rgba(251, 191, 36, 1);
  border-color: rgba(249, 115, 22, 0.46);
}

.track-empty {
  border: 1px dashed rgba(148, 163, 184, 0.42);
  border-radius: 14px;
  padding: 14px;
  color: rgba(203, 213, 225, 0.9);
  font-size: 0.88rem;
}

.track-grid {
  display: grid;
  gap: 8px;
}

.track-ruler {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  color: rgba(148, 163, 184, 0.9);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
}

.track-ruler span {
  text-align: right;
}

.track-ruler span:first-child {
  text-align: left;
}

.lane {
  display: grid;
  grid-template-columns: 38px 1fr;
  align-items: center;
  gap: 10px;
}

.lane-id {
  color: rgba(186, 230, 253, 0.95);
  font-size: 0.74rem;
  font-weight: 700;
}

.lane-track {
  position: relative;
  height: 56px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background:
    linear-gradient(
      90deg,
      rgba(148, 163, 184, 0.08) 0,
      rgba(148, 163, 184, 0.08) 24%,
      transparent 24%,
      transparent 25%,
      rgba(148, 163, 184, 0.08) 25%,
      rgba(148, 163, 184, 0.08) 49%,
      transparent 49%,
      transparent 50%,
      rgba(148, 163, 184, 0.08) 50%,
      rgba(148, 163, 184, 0.08) 74%,
      transparent 74%,
      transparent 75%,
      rgba(148, 163, 184, 0.08) 75%,
      rgba(148, 163, 184, 0.08) 100%
    ),
    rgba(15, 23, 42, 0.96);
  overflow: hidden;
  contain: layout paint;
}

.horse-token {
  --horse-token-width: 176px;
  position: absolute;
  top: 4px;
  left: calc(var(--progress) * (100% - var(--horse-token-width)));
  width: var(--horse-token-width);
  transform: translate3d(0, 0, 0);
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.5);
  background: linear-gradient(160deg, rgba(15, 23, 42, 0.55), rgba(15, 23, 42, 0.9));
  color: #f8fafc;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.3);
  will-change: left;
  backface-visibility: hidden;
}

.horse-art {
  width: 78px;
  height: 42px;
  flex: 0 0 78px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.42);
  background: linear-gradient(140deg, rgba(15, 23, 42, 0.18), rgba(15, 23, 42, 0.4));
  overflow: hidden;
  contain: paint;
}

.horse-shape {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--horse-color);
  -webkit-mask-image: var(--horse-mask);
  mask-image: var(--horse-mask);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
  will-change: mask-position;
}

.horse-meta {
  display: grid;
  min-width: 0;
}

.horse-token strong {
  font-size: 0.67rem;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 128px;
}

.horse-token small {
  font-size: 0.64rem;
  opacity: 0.95;
}

@media (max-width: 1024px) {
  .track-panel {
    min-height: auto;
  }

  .horse-token {
    --horse-token-width: 168px;
  }
}
</style>
