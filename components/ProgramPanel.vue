<script setup>
const props = defineProps({
  program: {
    type: Array,
    required: true
  },
  horsesById: {
    type: Object,
    required: true
  }
})

function participantLabel(round) {
  return round.horseIds
    .map((horseId) => props.horsesById.get(horseId)?.name ?? horseId)
    .join(", ")
}

function statusText(status) {
  if (status === "running") {
    return "Running"
  }
  if (status === "finished") {
    return "Finished"
  }
  return "Scheduled"
}
</script>

<template>
  <section class="panel">
    <header class="panel-header">
      <h2>Program</h2>
      <p>Round schedule and participants</p>
    </header>

    <ol class="program-list">
      <li
        v-for="round in program"
        :key="round.id"
        class="program-item"
        :class="`is-${round.status}`"
        data-testid="program-round"
      >
        <div class="program-main">
          <strong>Round {{ round.id }}</strong>
          <span>{{ round.distance }}m</span>
        </div>
        <div class="program-status">{{ statusText(round.status) }}</div>
        <p class="program-horses">{{ participantLabel(round) }}</p>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.panel {
  background: rgba(2, 6, 23, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 20px;
  padding: 18px;
  backdrop-filter: blur(6px);
}

.panel-header h2 {
  margin: 0;
  font-size: 1.15rem;
}

.panel-header p {
  margin: 4px 0 14px;
  color: rgba(226, 232, 240, 0.78);
  font-size: 0.84rem;
}

.program-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.program-item {
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  padding: 10px 12px;
  background: rgba(15, 23, 42, 0.88);
}

.program-item.is-running {
  border-color: rgba(249, 115, 22, 0.7);
}

.program-item.is-finished {
  border-color: rgba(34, 197, 94, 0.65);
}

.program-main {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
}

.program-main strong {
  font-size: 0.92rem;
}

.program-main span {
  color: rgba(191, 219, 254, 0.95);
  font-size: 0.8rem;
}

.program-status {
  font-size: 0.75rem;
  color: rgba(224, 231, 255, 0.9);
}

.program-horses {
  margin: 6px 0 0;
  font-size: 0.75rem;
  line-height: 1.35;
  color: rgba(203, 213, 225, 0.95);
}
</style>

