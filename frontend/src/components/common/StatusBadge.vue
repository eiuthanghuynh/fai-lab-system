<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  isActive?: boolean;
  activeText?: string;
  inactiveText?: string;
  variant?: 'success' | 'danger' | 'warning' | 'secondary' | 'info';
  text?: string;
}>();

const badgeClass = computed(() => {
  if (props.variant) return props.variant;
  return props.isActive ? 'active' : 'inactive';
});

const displayText = computed(() => {
  if (props.text) return props.text;
  return props.isActive ? props.activeText : props.inactiveText;
});
</script>

<template>
  <span :class="['status-dot', badgeClass]">
    {{ displayText }}
  </span>
</template>

<style scoped>
.status-dot {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-dot::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 0.5rem;
}

.status-dot.active, .status-dot.success {
  background-color: rgba(46, 204, 113, 0.1);
  color: #2ecc71;
}

.status-dot.active::before, .status-dot.success::before {
  background-color: #2ecc71;
  box-shadow: 0 0 8px rgba(46, 204, 113, 0.5);
}

.status-dot.inactive, .status-dot.danger {
  background-color: rgba(231, 76, 60, 0.1);
  color: #e74c3c;
}

.status-dot.inactive::before, .status-dot.danger::before {
  background-color: #e74c3c;
  box-shadow: 0 0 8px rgba(231, 76, 60, 0.5);
}

.status-dot.warning {
  background-color: rgba(241, 196, 15, 0.1);
  color: #f39c12;
}

.status-dot.warning::before {
  background-color: #f39c12;
  box-shadow: 0 0 8px rgba(241, 196, 15, 0.5);
}

.status-dot.secondary {
  background-color: rgba(149, 165, 166, 0.1);
  color: #95a5a6;
}

.status-dot.secondary::before {
  background-color: #95a5a6;
  box-shadow: 0 0 8px rgba(149, 165, 166, 0.5);
}

.status-dot.info {
  background-color: rgba(52, 152, 219, 0.1);
  color: #3498db;
}

.status-dot.info::before {
  background-color: #3498db;
  box-shadow: 0 0 8px rgba(52, 152, 219, 0.5);
}
</style>
