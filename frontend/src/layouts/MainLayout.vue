<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useDark, useToggle } from '@vueuse/core';
import { getContrastColor } from '../utils/color';
import XpLogo from '../assets/XP-logo-white.svg';
import LanguageSwitcher from '../components/LanguageSwitcher.vue';
import ConfirmModal from '../components/ConfirmModal.vue';
import RoleBadgeList from '../components/common/RoleBadgeList.vue';
import api from '../services/api';
import Button from '../components/ui/Button.vue';

const authStore = useAuthStore();
const router = useRouter();
const { t } = useI18n();

const showLogoutConfirm = ref(false);

const handleLogout = async () => {
  try {
    await api.post('/auth/logout');
  } catch (err) {
    console.error('Logout error:', err);
  } finally {
    authStore.logout();
    showLogoutConfirm.value = false;
    router.push({ name: 'login' });
  }
};

const isDbMenuOpen = ref(false);
const toggleDbMenu = () => {
  isDbMenuOpen.value = !isDbMenuOpen.value;
};

const isFaiMenuOpen = ref(false);
const toggleFaiMenu = () => {
  isFaiMenuOpen.value = !isFaiMenuOpen.value;
};

const isLabMenuOpen = ref(false);
const toggleLabMenu = () => {
  isLabMenuOpen.value = !isLabMenuOpen.value;
};

const hasAccess = (routeName: string) => {
  const route = router.getRoutes().find(r => r.name === routeName);
  if (!route || !route.meta?.permission) return true; // Accessible to all logged-in users if no permission defined
  const perms = Array.isArray(route.meta.permission) ? route.meta.permission : [route.meta.permission];
  return perms.some(p => authStore.hasPermission(p as string));
};

// Theme setup
const isDark = useDark({ 
  initialValue: 'light',
  disableTransition: true // Tắt transition CSS cũ vì đã dùng View Transition
});
const rawToggle = useToggle(isDark);
const toggleDark = () => {
  if (!document.startViewTransition) return rawToggle();
  document.startViewTransition(() => rawToggle());
};
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <aside class="w-[260px] bg-bg-surface border-r border-border flex flex-col">
      <div class="p-6 border-b border-border flex flex-col gap-4">
        <div class="bg-black rounded p-2.5 flex justify-center items-center">
          <img :src="XpLogo" alt="XP Power Logo" class="max-w-[150px] h-auto" />
        </div>
        <h2 class="text-primary text-xl m-0 text-center font-bold">FAI/LAB System</h2>
      </div>
      <nav class="flex-1 py-6 flex flex-col overflow-y-auto">
        <router-link to="/" class="px-6 py-3 text-text-muted font-medium border-l-[3px] border-transparent flex justify-between items-center cursor-pointer no-underline hover:text-text hover:bg-white/5 hover:border-primary [&.router-link-exact-active]:text-text [&.router-link-exact-active]:bg-white/5 [&.router-link-exact-active]:border-primary">{{ t('nav.home') }}</router-link>
        
        <div v-if="hasAccess('fai-request-create') || hasAccess('fai-request-list')" class="flex flex-col">
          <div class="px-6 py-3 text-text-muted font-medium border-l-[3px] border-transparent flex justify-between items-center cursor-pointer select-none hover:text-text hover:bg-white/5 hover:border-primary" @click="toggleFaiMenu">
            <span>{{ t('nav.fai_requests') }}</span>
            <span class="text-[0.7rem] transition-transform duration-300" :class="{ 'rotate-180': isFaiMenuOpen }">▼</span>
          </div>
          <Transition 
            enter-active-class="transition-all duration-300 ease-in-out"
            leave-active-class="transition-all duration-300 ease-in-out"
            enter-from-class="max-h-0 opacity-0"
            enter-to-class="max-h-[200px] opacity-100"
            leave-from-class="max-h-[200px] opacity-100"
            leave-to-class="max-h-0 opacity-0"
          >
            <div v-show="isFaiMenuOpen" class="flex flex-col bg-black/10 overflow-hidden">
              <router-link v-if="hasAccess('fai-request-create')" to="/fai/request/create" class="py-2 pr-6 pl-10 text-text-muted text-sm font-normal no-underline border-l-[3px] border-transparent hover:text-text hover:bg-white/5 hover:border-primary [&.router-link-exact-active]:text-text [&.router-link-exact-active]:bg-white/5 [&.router-link-exact-active]:border-primary">{{ t('nav.create_request') }}</router-link>
              <router-link v-if="hasAccess('fai-request-list')" to="/fai/request/list" class="py-2 pr-6 pl-10 text-text-muted text-sm font-normal no-underline border-l-[3px] border-transparent hover:text-text hover:bg-white/5 hover:border-primary [&.router-link-exact-active]:text-text [&.router-link-exact-active]:bg-white/5 [&.router-link-exact-active]:border-primary">{{ t('nav.view_requests') }}</router-link>
            </div>
          </Transition>
        </div>
        <div v-if="hasAccess('lab-request-create') || hasAccess('lab-request-list')" class="flex flex-col">
          <div class="px-6 py-3 text-text-muted font-medium border-l-[3px] border-transparent flex justify-between items-center cursor-pointer select-none hover:text-text hover:bg-white/5 hover:border-primary" @click="toggleLabMenu">
            <span>{{ t('nav.lab_requests') }}</span>
            <span class="text-[0.7rem] transition-transform duration-300" :class="{ 'rotate-180': isLabMenuOpen }">▼</span>
          </div>
          <Transition 
            enter-active-class="transition-all duration-300 ease-in-out"
            leave-active-class="transition-all duration-300 ease-in-out"
            enter-from-class="max-h-0 opacity-0"
            enter-to-class="max-h-[200px] opacity-100"
            leave-from-class="max-h-[200px] opacity-100"
            leave-to-class="max-h-0 opacity-0"
          >
            <div v-show="isLabMenuOpen" class="flex flex-col bg-black/10 overflow-hidden">
              <router-link v-if="hasAccess('lab-request-create')" to="/lab/request/create" class="py-2 pr-6 pl-10 text-text-muted text-sm font-normal no-underline border-l-[3px] border-transparent hover:text-text hover:bg-white/5 hover:border-primary [&.router-link-exact-active]:text-text [&.router-link-exact-active]:bg-white/5 [&.router-link-exact-active]:border-primary">{{ t('nav.create_request') }}</router-link>
              <router-link v-if="hasAccess('lab-request-list')" to="/lab/request/list" class="py-2 pr-6 pl-10 text-text-muted text-sm font-normal no-underline border-l-[3px] border-transparent hover:text-text hover:bg-white/5 hover:border-primary [&.router-link-exact-active]:text-text [&.router-link-exact-active]:bg-white/5 [&.router-link-exact-active]:border-primary">{{ t('nav.view_requests') }}</router-link>
            </div>
          </Transition>
        </div>
        <div v-if="hasAccess('admin-users') || hasAccess('admin-roles')" class="flex flex-col">
          <div class="px-6 py-3 text-text-muted font-medium border-l-[3px] border-transparent flex justify-between items-center cursor-pointer select-none hover:text-text hover:bg-white/5 hover:border-primary" @click="toggleDbMenu">
            <span>{{ t('nav.db_management') }}</span>
            <span class="text-[0.7rem] transition-transform duration-300" :class="{ 'rotate-180': isDbMenuOpen }">▼</span>
          </div>
          <Transition 
            enter-active-class="transition-all duration-300 ease-in-out"
            leave-active-class="transition-all duration-300 ease-in-out"
            enter-from-class="max-h-0 opacity-0"
            enter-to-class="max-h-[200px] opacity-100"
            leave-from-class="max-h-[200px] opacity-100"
            leave-to-class="max-h-0 opacity-0"
          >
            <div v-show="isDbMenuOpen" class="flex flex-col bg-black/10 overflow-hidden">
              <router-link v-if="hasAccess('admin-users')" to="/admin/users" class="py-2 pr-6 pl-10 text-text-muted text-sm font-normal no-underline border-l-[3px] border-transparent hover:text-text hover:bg-white/5 hover:border-primary [&.router-link-exact-active]:text-text [&.router-link-exact-active]:bg-white/5 [&.router-link-exact-active]:border-primary">{{ t('admin.users') }}</router-link>
              <router-link v-if="hasAccess('admin-roles')" to="/admin/roles" class="py-2 pr-6 pl-10 text-text-muted text-sm font-normal no-underline border-l-[3px] border-transparent hover:text-text hover:bg-white/5 hover:border-primary [&.router-link-exact-active]:text-text [&.router-link-exact-active]:bg-white/5 [&.router-link-exact-active]:border-primary">{{ t('admin.roles') }}</router-link>
              <router-link v-if="hasAccess('admin-roles')" to="/admin/fai-failure-modes" class="py-2 pr-6 pl-10 text-text-muted text-sm font-normal no-underline border-l-[3px] border-transparent hover:text-text hover:bg-white/5 hover:border-primary [&.router-link-exact-active]:text-text [&.router-link-exact-active]:bg-white/5 [&.router-link-exact-active]:border-primary">{{ t('admin.fai_failure_modes', 'FAI Failure Modes') }}</router-link>
              <router-link v-if="hasAccess('admin-roles')" to="/admin/commodity-parts" class="py-2 pr-6 pl-10 text-text-muted text-sm font-normal no-underline border-l-[3px] border-transparent hover:text-text hover:bg-white/5 hover:border-primary [&.router-link-exact-active]:text-text [&.router-link-exact-active]:bg-white/5 [&.router-link-exact-active]:border-primary">{{ t('admin.commodity_parts', 'Commodity Parts') }}</router-link>
            </div>
          </Transition>
        </div>
      </nav>
      
      <div class="p-6 border-t border-border flex flex-col gap-4">
        <div class="flex flex-col gap-1 pb-2 mb-2 border-b border-border">
          <LanguageSwitcher />
          
          <div class="flex justify-between items-center px-1 py-2">
            <span class="text-sm text-text font-medium">{{ t('common.dark_mode') }}</span>
            <div 
              class="relative inline-block w-[44px] h-[24px] rounded-full cursor-pointer transition-colors duration-300"
              :class="isDark ? 'bg-[#34C759]' : 'bg-[#ccc]'"
              @click="toggleDark()"
            >
              <div 
                class="absolute h-[20px] w-[20px] left-[2px] bottom-[2px] bg-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-all duration-300"
                :class="isDark ? 'translate-x-[20px]' : 'translate-x-0'"
              ></div>
            </div>
          </div>
        </div>
        
        <div class="flex flex-col gap-1">
          <div class="flex flex-col items-start gap-1 w-full overflow-hidden">
            <span class="font-semibold text-[0.95rem] text-text whitespace-nowrap overflow-hidden text-ellipsis w-full" :title="authStore.user?.full_name">{{ authStore.user?.full_name }}</span>
            <RoleBadgeList :roles="authStore.user?.roles || []" />
          </div>
          <div v-if="authStore.user?.department" class="text-[0.8rem] text-text-muted">{{ authStore.user?.department }}</div>
          <div class="text-[0.8rem] text-text-muted">{{ authStore.user?.email }}</div>
        </div>

        <Button @click="showLogoutConfirm = true" variant="secondary" class="w-full mt-2 border border-border text-text-muted hover:bg-red-500/10 hover:text-red-500 hover:border-red-500">
          {{ t('nav.logout') }}
        </Button>
      </div>
    </aside>
    
    <main class="flex-1 bg-bg h-screen overflow-y-auto overflow-x-hidden flex flex-col">
      <router-view v-slot="{ Component }">
        <transition 
          enter-active-class="transition-opacity duration-200"
          leave-active-class="transition-opacity duration-200"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
          mode="out-in"
        >
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <ConfirmModal 
      :isOpen="showLogoutConfirm" 
      :title="t('nav.logout')" 
      :message="t('nav.logout_warning')"
      :isDanger="true" 
      @confirm="handleLogout" 
      @cancel="showLogoutConfirm = false" 
    />
  </div>
</template>
