import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { socketService } from '@/services/socket';
import api from '@/services/api';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  const user = ref<{ id: number; username: string; email: string; full_name: string; department?: string; roles: { id: number, name: string, badge_color: string }[] } | null>(null);
  const permissions = ref<string[]>([]);

  const isAuthenticated = computed(() => !!token.value);

  function setAuth(newToken: string, newUser: any, newPermissions: string[]) {
    token.value = newToken;
    user.value = newUser;
    permissions.value = newPermissions;

    socketService.connect();
  }

  function logout() {
    token.value = null;
    user.value = null;
    permissions.value = [];

    socketService.disconnect();
  }

  async function autoLogin() {
    try {
      const res = await api.get('/auth/me');
      setAuth(res.data.token, res.data.user, res.data.user.permissions);
      return true;
    } catch (e: any) {
      if (e.response?.status !== 401) {
        console.error('Auto-login failed', e);
      }
    }
    return false;
  }

  async function refreshPermissions() {
    if (!token.value) return;
    try {
      const res = await api.get('/auth/permissions');
      permissions.value = res.data.permissions;
    } catch (e: any) {
      console.error('Failed to refresh permissions', e);
      if (e.response && (e.response.status === 401 || e.response.status === 403)) {
        logout();
      }
    }
  }

  function hasPermission(permission: string) {
    return permissions.value.includes(permission);
  }

  return {
    token,
    user,
    permissions,
    isAuthenticated,
    setAuth,
    logout,
    hasPermission,
    autoLogin,
    refreshPermissions
  };
});
