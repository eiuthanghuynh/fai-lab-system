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
  disableTransition: false
});
const toggleDark = useToggle(isDark);
</script>

<template>
  <div class="layout-wrapper">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-wrapper">
          <img :src="XpLogo" alt="XP Power Logo" class="xp-logo" />
        </div>
        <h2>FAI/LAB System</h2>
      </div>
      <nav class="nav-links">
        <router-link to="/" class="nav-item">{{ t('nav.home') }}</router-link>
        
        <div v-if="hasAccess('fai-request-create') || hasAccess('fai-request-list')" class="nav-group">
          <div class="nav-item nav-group-header" @click="toggleFaiMenu">
            <span>{{ t('nav.fai_requests') }}</span>
            <span class="arrow" :class="{ 'open': isFaiMenuOpen }">▼</span>
          </div>
          <Transition name="accordion">
            <div v-show="isFaiMenuOpen" class="nav-sub-links">
              <router-link v-if="hasAccess('fai-request-create')" to="/fai/request/create" class="nav-sub-item">{{ t('nav.create_request') }}</router-link>
              <router-link v-if="hasAccess('fai-request-list')" to="/fai/request/list" class="nav-sub-item">{{ t('nav.view_requests') }}</router-link>
            </div>
          </Transition>
        </div>
        <div v-if="hasAccess('lab-request-create') || hasAccess('lab-request-list')" class="nav-group">
          <div class="nav-item nav-group-header" @click="toggleLabMenu">
            <span>{{ t('nav.lab_requests') }}</span>
            <span class="arrow" :class="{ 'open': isLabMenuOpen }">▼</span>
          </div>
          <Transition name="accordion">
            <div v-show="isLabMenuOpen" class="nav-sub-links">
              <router-link v-if="hasAccess('lab-request-create')" to="/lab/request/create" class="nav-sub-item">{{ t('nav.create_request') }}</router-link>
              <router-link v-if="hasAccess('lab-request-list')" to="/lab/request/list" class="nav-sub-item">{{ t('nav.view_requests') }}</router-link>
            </div>
          </Transition>
        </div>
        <div v-if="hasAccess('admin-users') || hasAccess('admin-roles')" class="nav-group">
          <div class="nav-item nav-group-header" @click="toggleDbMenu">
            <span>{{ t('nav.db_management') }}</span>
            <span class="arrow" :class="{ 'open': isDbMenuOpen }">▼</span>
          </div>
          <Transition name="accordion">
            <div v-show="isDbMenuOpen" class="nav-sub-links">
              <router-link v-if="hasAccess('admin-users')" to="/admin/users" class="nav-sub-item">{{ t('admin.users') }}</router-link>
              <router-link v-if="hasAccess('admin-roles')" to="/admin/roles" class="nav-sub-item">{{ t('admin.roles') }}</router-link>
              <router-link v-if="hasAccess('admin-roles')" to="/admin/fai-failure-modes" class="nav-sub-item">{{ t('admin.fai_failure_modes', 'FAI Failure Modes') }}</router-link>
              <router-link v-if="hasAccess('admin-roles')" to="/admin/commodity-parts" class="nav-sub-item">{{ t('admin.commodity_parts', 'Commodity Parts') }}</router-link>
            </div>
          </Transition>
        </div>
      </nav>
      
      <div class="sidebar-footer">
        <div class="controls-group">
          <LanguageSwitcher />
          
          <div class="theme-switch-wrapper">
            <span class="theme-label">{{ t('common.dark_mode') }}</span>
            <div class="ios-switch" :class="{ 'active': isDark }" @click="toggleDark()">
              <div class="slider"></div>
            </div>
          </div>
        </div>
        
        <div class="user-info-box">
          <div class="user-name-role">
            <span class="user-name" :title="authStore.user?.full_name">{{ authStore.user?.full_name }}</span>
            <RoleBadgeList :roles="authStore.user?.roles || []" />
          </div>
          <div v-if="authStore.user?.department" class="user-dept">{{ authStore.user?.department }}</div>
          <div class="user-email">{{ authStore.user?.email }}</div>
        </div>

        <button @click="showLogoutConfirm = true" class="btn-logout">{{ t('nav.logout') }}</button>
      </div>
    </aside>
    
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="page-fade" mode="out-in">
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

<style scoped>
.layout-wrapper {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: 260px;
  background-color: var(--color-bg-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.logo-wrapper {
  background-color: #000;
  border-radius: 4px;
  padding: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.xp-logo {
  max-width: 150px;
  height: auto;
}

.sidebar-header h2 {
  color: var(--color-primary);
  font-size: 1.25rem;
  margin: 0;
  text-align: center;
}

.nav-links {
  flex: 1;
  padding: 1.5rem 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.nav-item {
  padding: 0.75rem 1.5rem;
  color: var(--color-text-muted);
  font-weight: 500;
  border-left: 3px solid transparent;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  text-decoration: none;
}

.nav-item:hover, .nav-item.router-link-exact-active {
  color: var(--color-text);
  background-color: rgba(255, 255, 255, 0.03);
  border-left-color: var(--color-primary);
}

.nav-group {
  display: flex;
  flex-direction: column;
}

.nav-group-header {
  user-select: none;
}

.nav-group-header .arrow {
  font-size: 0.7rem;
  transition: transform 0.3s ease;
}

.nav-group-header .arrow.open {
  transform: rotate(180deg);
}

.accordion-enter-active,
.accordion-leave-active {
  transition: max-height 0.3s ease, opacity 0.3s ease;
  max-height: 200px; /* should be enough for sub-items */
  overflow: hidden;
}
.accordion-enter-from,
.accordion-leave-to {
  max-height: 0;
  opacity: 0;
}

.nav-sub-links {
  display: flex;
  flex-direction: column;
  background-color: rgba(0, 0, 0, 0.1);
}

.nav-sub-item {
  padding: 0.5rem 1.5rem 0.5rem 2.5rem;
  color: var(--color-text-muted);
  font-weight: 400;
  font-size: 0.9rem;
  text-decoration: none;
  border-left: 3px solid transparent;
}

.nav-sub-item:hover, .nav-sub-item.router-link-exact-active {
  color: var(--color-text);
  background-color: rgba(255, 255, 255, 0.05);
  border-left-color: var(--color-primary);
}

.sidebar-footer {
  padding: 1.5rem;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.user-info-box {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.user-name-role {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  width: 100%;
  overflow: hidden;
}

.user-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.user-dept, .user-email {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.btn-logout {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  padding: 0.5rem;
  border-radius: 4px;
  width: 100%;
  transition: all var(--transition-speed) ease;
}

.btn-logout:hover {
  background-color: rgba(255, 85, 85, 0.1);
  color: #ff5555;
  border-color: #ff5555;
}

.controls-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.theme-switch-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.25rem;
}

.theme-label {
  font-size: 0.875rem;
  color: var(--color-text);
  font-weight: 500;
}

/* iOS Toggle Switch - Vue Class Based */
.ios-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  background-color: #ccc;
  border-radius: 24px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.ios-switch.active {
  background-color: #34C759; /* iOS Green */
}

.ios-switch .slider {
  position: absolute;
  height: 20px;
  width: 20px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  transition: all 0.3s ease;
}

.ios-switch.active .slider {
  left: 22px;
}

.main-content {
  flex: 1;
  background-color: var(--color-bg);
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}
</style>
