<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { getContrastColor } from '@/utils/color';

const props = defineProps({
  roles: {
    type: Array as () => any[],
    default: () => []
  }
});

const containerRef = ref<HTMLElement | null>(null);
const badgeRefs = ref<HTMLElement[]>([]);
const visibleCount = ref<number | null>(null);

const isTooltipVisible = ref(false);
const tooltipStyle = ref({ top: '0px', left: '0px', transform: 'translate(-50%, -100%)' });
const arrowStyle = ref({ left: '50%' });

const tooltipRef = ref<HTMLElement | null>(null);

let resizeObserver: ResizeObserver | null = null;
let tooltipTimeout: number | null = null;
const uniqueId = Math.random().toString(36).substring(2, 9);

const handleCloseTooltips = (e: Event) => {
  const customEvent = e as CustomEvent;
  if (customEvent.detail !== uniqueId) {
    isTooltipVisible.value = false;
  }
};

const calculate = () => {
  if (!containerRef.value || props.roles.length === 0) return;
  
  // Reset temporarily to measure full widths
  visibleCount.value = null;
  
  nextTick(() => {
    if (!containerRef.value) return;
    const containerWidth = containerRef.value.clientWidth;
    
    let currentWidth = 0;
    const gap = 4; // 0.25rem = 4px
    const ellipsisWidth = 28; // Estimated width of "..." badge
    let count = 0;

    for (let i = 0; i < props.roles.length; i++) {
      const el = badgeRefs.value[i];
      if (!el) continue;
      
      const elWidth = el.offsetWidth;
      // If it's the last element, we don't need ellipsis
      if (i === props.roles.length - 1) {
        if (currentWidth + elWidth <= containerWidth) {
          count++;
        }
        break;
      }

      // If we add this element, will it fit along with a potential ellipsis (if there are more elements)?
      if (currentWidth + elWidth + gap + ellipsisWidth > containerWidth) {
        break;
      }
      
      currentWidth += elWidth + gap;
      count++;
    }

    // Always show at least 1 badge if possible, even if it cuts off (CSS handles truncation of the badge itself)
    if (count === 0 && props.roles.length > 0) {
      count = 1;
    }

    visibleCount.value = count;
  });
};

onMounted(() => {
  calculate();
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      calculate();
    });
    resizeObserver.observe(containerRef.value);
  }
  window.addEventListener('close-tooltips', handleCloseTooltips);
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  clearTimeout(tooltipTimeout!);
  window.removeEventListener('close-tooltips', handleCloseTooltips);
});

watch(() => props.roles, () => {
  calculate();
}, { deep: true });

// --- Tooltip Logic ---

const handleMouseEnter = (e: MouseEvent) => {
  // Only show tooltip if there are roles and if overflow condition is met
  if (props.roles.length === 0) return;
  if (visibleCount.value !== null && visibleCount.value >= props.roles.length) return;
  
  window.dispatchEvent(new CustomEvent('close-tooltips', { detail: uniqueId }));
  
  clearTimeout(tooltipTimeout!);
  isTooltipVisible.value = true;
  updateTooltipPosition(e);
};

const handleMouseLeave = () => {
  tooltipTimeout = window.setTimeout(() => {
    isTooltipVisible.value = false;
  }, 300); // 300ms grace period to move mouse to tooltip
};

const keepTooltip = () => {
  clearTimeout(tooltipTimeout!);
};

const updateTooltipPosition = (e: MouseEvent) => {
  if (!isTooltipVisible.value) return;
  
  const mouseX = e.clientX;
  
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    const top = rect.top - 10; 
    
    // Use requestAnimationFrame or nextTick to wait for tooltip render if needed
    nextTick(() => {
      const tooltipEl = tooltipRef.value;
      const tooltipWidth = tooltipEl ? tooltipEl.offsetWidth : 200;
      
      let left = mouseX;
      const halfWidth = tooltipWidth / 2;
      const padding = 16;
      
      // Clamp to viewport
      if (left - halfWidth < padding) {
        left = halfWidth + padding;
      } else if (left + halfWidth > window.innerWidth - padding) {
        left = window.innerWidth - halfWidth - padding;
      }
      
      // Calculate arrow position relative to tooltip
      let arrowLeft = mouseX - (left - halfWidth);
      if (arrowLeft < 16) arrowLeft = 16;
      if (arrowLeft > tooltipWidth - 16) arrowLeft = tooltipWidth - 16;
      
      tooltipStyle.value = {
        top: `${top}px`,
        left: `${left}px`,
        transform: 'translate(-50%, -100%)'
      };
      
      arrowStyle.value = {
        left: `${arrowLeft}px`
      };
    });
  }
};
</script>

<template>
  <div 
    class="role-badge-list-container" 
    ref="containerRef"
  >
    <div 
      class="badges-wrapper"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @mousemove="updateTooltipPosition"
    >
      <span 
        v-for="(role, index) in roles" 
        :key="role.id" 
        class="role-badge" 
        :ref="el => { if (el) badgeRefs[index] = el as HTMLElement }"
        :class="{ 'hidden-badge': visibleCount !== null && index >= visibleCount }"
        :style="{ 
          backgroundColor: role.badge_color || '#63e079', 
          color: getContrastColor(role.badge_color || '#63e079')
        }"
      >
        {{ role.name }}
      </span>
      <span 
        v-if="visibleCount !== null && visibleCount < roles.length" 
        class="role-badge ellipsis-badge"
      >
        ...
      </span>
    </div>

    <!-- Teleported Tooltip -->
    <Teleport to="body">
      <Transition name="tooltip-fade">
        <div 
          v-if="isTooltipVisible" 
          class="roles-custom-tooltip" 
          :style="tooltipStyle"
          @mouseenter="keepTooltip"
          @mouseleave="handleMouseLeave"
          ref="tooltipRef"
        >
          <div class="tooltip-content">
            <span 
              v-for="role in roles" 
              :key="'tt-' + role.id" 
              class="role-badge" 
              :style="{ backgroundColor: role.badge_color || '#63e079', color: getContrastColor(role.badge_color || '#63e079') }"
            >
              {{ role.name }}
            </span>
          </div>
          <div class="tooltip-arrow" :style="arrowStyle"></div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.role-badge-list-container {
  width: 100%;
  position: relative;
  cursor: default;
}

.badges-wrapper {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 0.25rem;
  max-width: 100%;
  overflow: hidden;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hidden-badge {
  position: absolute;
  visibility: hidden;
  pointer-events: none;
}

.ellipsis-badge {
  background-color: var(--color-bg-surface, #e2e8f0);
  color: var(--color-text, #1e293b);
  border: 1px solid var(--color-border, #cbd5e1);
  padding: 0.15rem 0.4rem;
  font-weight: 900;
  letter-spacing: 1px;
}

/* Tooltip Styles */
.roles-custom-tooltip {
  position: fixed;
  z-index: 10000;
  /* Transform translates -50% horizontally so mouseX is center, and -100% vertically to be above */
  transform: translate(-50%, -100%);
  background: var(--color-bg-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  padding: 0.75rem;
  max-width: 320px;
  pointer-events: auto; /* Allow interaction */
}

/* Dark mode overrides if any */
:global(.dark) .roles-custom-tooltip {
  background: #1e293b;
  border-color: #334155;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
}

.tooltip-content {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-content: center;
}

.tooltip-arrow {
  position: absolute;
  bottom: -6px;
  /* left is set dynamically inline */
  transform: translateX(-50%) rotate(45deg);
  width: 12px;
  height: 12px;
  background: inherit;
  border-right: 1px solid var(--color-border, #e2e8f0);
  border-bottom: 1px solid var(--color-border, #e2e8f0);
  z-index: -1;
  transition: left 0.1s ease;
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -90%) scale(0.95);
}
</style>
