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
    class="w-full relative cursor-default" 
    ref="containerRef"
  >
    <div 
      class="inline-flex flex-row items-center gap-1 max-w-full overflow-hidden"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @mousemove="updateTooltipPosition"
    >
      <span 
        v-for="(role, index) in roles" 
        :key="role.id" 
        class="inline-flex items-center justify-center px-2 py-0.5 rounded-[12px] text-[0.7rem] font-bold whitespace-nowrap shrink-0 max-w-full overflow-hidden truncate" 
        :ref="el => { if (el) badgeRefs[index] = el as HTMLElement }"
        :class="{ 'absolute invisible pointer-events-none': visibleCount !== null && index >= visibleCount }"
        :style="{ 
          backgroundColor: role.badge_color || '#63e079', 
          color: getContrastColor(role.badge_color || '#63e079')
        }"
      >
        {{ role.name }}
      </span>
      <span 
        v-if="visibleCount !== null && visibleCount < roles.length" 
        class="inline-flex items-center justify-center rounded-[12px] text-[0.7rem] shrink-0 max-w-full overflow-hidden truncate bg-bg-surface text-text border border-border px-1.5 py-0.5 font-black tracking-widest"
      >
        ...
      </span>
    </div>

    <!-- Teleported Tooltip -->
    <Teleport to="body">
      <Transition 
        enter-active-class="transition-opacity duration-200 ease-out"
        leave-active-class="transition-opacity duration-200 ease-in"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div 
          v-if="isTooltipVisible" 
          class="fixed z-[10000] bg-bg-surface border border-border rounded-xl shadow-xl p-3 max-w-[320px] pointer-events-auto" 
          :style="tooltipStyle"
          @mouseenter="keepTooltip"
          @mouseleave="handleMouseLeave"
          ref="tooltipRef"
        >
          <div class="flex flex-wrap gap-1.5 justify-center">
            <span 
              v-for="role in roles" 
              :key="'tt-' + role.id" 
              class="inline-flex items-center justify-center px-2 py-0.5 rounded-[12px] text-[0.7rem] font-bold whitespace-nowrap shrink-0 max-w-full overflow-hidden truncate" 
              :style="{ backgroundColor: role.badge_color || '#63e079', color: getContrastColor(role.badge_color || '#63e079') }"
            >
              {{ role.name }}
            </span>
          </div>
          <div class="absolute -bottom-[6px] w-3 h-3 bg-inherit border-r border-b border-border -z-10 transition-[left] duration-100 ease-out" style="transform: translateX(-50%) rotate(45deg);" :style="arrowStyle"></div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
