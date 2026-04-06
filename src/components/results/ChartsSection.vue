<script setup lang="ts">
import VcpuChart from './charts/VcpuChart.vue'
import RamChart from './charts/RamChart.vue'
import StorageChart from './charts/StorageChart.vue'
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
    <VcpuChart />
    <RamChart />
    <StorageChart />
  </div>
</template>
