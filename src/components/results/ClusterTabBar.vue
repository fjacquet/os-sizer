<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'

const { t } = useI18n()
const input = useInputStore()
const { clusters, activeClusterIndex } = storeToRefs(input)

const MAX_CLUSTERS = 5

// Rename state
const renamingId = ref<string | null>(null)
const renameValue = ref('')

function startRename(id: string, currentName: string) {
  renamingId.value = id
  renameValue.value = currentName
}

function commitRename(id: string) {
  const trimmed = renameValue.value.trim()
  if (trimmed) {
    input.updateCluster(id, { name: trimmed })
  }
  renamingId.value = null
}

function cancelRename() {
  renamingId.value = null
}

// Role dropdown state — one open at a time
const openDropdownId = ref<string | null>(null)

function toggleDropdown(id: string) {
  openDropdownId.value = openDropdownId.value === id ? null : id
}

function closeDropdown() {
  openDropdownId.value = null
}

function selectRole(id: string, role: 'hub' | 'spoke' | 'standalone') {
  input.updateCluster(id, { role })
  openDropdownId.value = null
}

function roleBadgeClass(role: 'hub' | 'spoke' | 'standalone' | undefined) {
  switch (role) {
    case 'hub':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    case 'spoke':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  }
}

function roleLabel(role: 'hub' | 'spoke' | 'standalone' | undefined) {
  switch (role) {
    case 'hub':
      return t('results.clusters.roleHub')
    case 'spoke':
      return t('results.clusters.roleSpoke')
    default:
      return t('results.clusters.roleStandalone')
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1 mb-4 border-b border-gray-200 dark:border-gray-700 pb-0">
    <!-- Cluster tabs -->
    <div
      v-for="(cluster, idx) in clusters"
      :key="cluster.id"
      class="relative"
    >
      <button
        class="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-t border border-b-0 transition-colors"
        :class="idx === activeClusterIndex
          ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100'
          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'"
        :aria-selected="idx === activeClusterIndex"
        role="tab"
        @click="input.activeClusterIndex = idx"
      >
        <!-- Role badge -->
        <span
          class="text-xs font-semibold px-1 rounded cursor-pointer"
          :class="roleBadgeClass(cluster.role)"
          @click.stop="toggleDropdown(cluster.id)"
        >
          {{ roleLabel(cluster.role) }}
        </span>

        <!-- Cluster name (or inline rename input) -->
        <span
          v-if="renamingId !== cluster.id"
          class="max-w-24 truncate"
          @dblclick.stop="startRename(cluster.id, cluster.name)"
        >
          {{ cluster.name }}
        </span>
        <input
          v-else
          v-model="renameValue"
          class="w-24 text-sm px-1 border border-blue-400 dark:border-blue-500 rounded outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          type="text"
          :aria-label="cluster.name"
          @click.stop
          @keydown.enter.prevent="commitRename(cluster.id)"
          @keydown.escape.prevent="cancelRename()"
          @blur="commitRename(cluster.id)"
        />

        <!-- Chevron — opens role dropdown -->
        <span
          class="text-xs text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
          aria-hidden="true"
          @click.stop="toggleDropdown(cluster.id)"
        >&#9662;</span>

        <!-- Remove button (hidden when only 1 cluster — T-18-03) -->
        <button
          v-if="clusters.length > 1"
          class="ml-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 leading-none"
          :aria-label="t('results.clusters.removeCluster') + ' ' + cluster.name"
          @click.stop="input.removeCluster(cluster.id)"
        >
          &#x2715;
        </button>
      </button>

      <!-- Role dropdown -->
      <div
        v-if="openDropdownId === cluster.id"
        class="absolute top-full left-0 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-md min-w-28 mt-0.5"
        role="listbox"
      >
        <button
          v-for="roleOption in (['hub', 'spoke', 'standalone'] as const)"
          :key="roleOption"
          class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
          :class="cluster.role === roleOption ? 'font-semibold' : ''"
          role="option"
          :aria-selected="cluster.role === roleOption"
          @click="selectRole(cluster.id, roleOption)"
        >
          {{ roleOption === 'hub' ? t('results.clusters.roleHub')
            : roleOption === 'spoke' ? t('results.clusters.roleSpoke')
            : t('results.clusters.roleStandalone') }}
        </button>
      </div>
    </div>

    <!-- Add cluster button (disabled at MAX_CLUSTERS=5 — T-18-02) -->
    <button
      class="px-3 py-2 text-sm font-medium rounded-t border border-dashed transition-colors"
      :class="clusters.length >= MAX_CLUSTERS
        ? 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50'
        : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-200'"
      :disabled="clusters.length >= MAX_CLUSTERS"
      :title="clusters.length >= MAX_CLUSTERS ? t('results.clusters.maxClustersReached') : undefined"
      :aria-label="t('results.clusters.addCluster')"
      @click="input.addCluster()"
    >
      + {{ t('results.clusters.addCluster') }}
    </button>
  </div>

  <!-- Click-outside overlay to close dropdown -->
  <div
    v-if="openDropdownId !== null"
    class="fixed inset-0 z-9"
    @click="closeDropdown()"
  />
</template>
