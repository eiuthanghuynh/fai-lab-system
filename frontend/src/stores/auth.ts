import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { socketService } from '@/services/socket';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('jwt_token'));
  const user = ref<{ id: number; username: string; email: string; full_name: string; department?: string; roles: { id: number, name: string, badge_color: string }[] } | null>(
    JSON.parse(localStorage.getItem('user_data') || 'null')
  );
  const permissions = ref<string[]>(
    JSON.parse(localStorage.getItem('permissions') || '[]')
  );

  const isAuthenticated = computed(() => !!token.value);

  function setAuth(newToken: string, newUser: any, newPermissions: string[]) {
    token.value = newToken;
    user.value = newUser;
    permissions.value = newPermissions;

    localStorage.setItem('jwt_token', newToken);
    localStorage.setItem('user_data', JSON.stringify(newUser));
    localStorage.setItem('permissions', JSON.stringify(newPermissions));

    socketService.connect();
  }

  function logout() {
    token.value = null;
    user.value = null;
    permissions.value = [];

    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('permissions');

    socketService.disconnect();
  }

  async function autoLogin() {
    try {
      const res = await fetch('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' // Important for sending the cookie
      });
      if (res.ok) {
        const data = await res.json();
        setAuth(data.token, data.user, data.user.permissions);
        return true;
      }
    } catch (e) {
      console.error('Auto-login failed', e);
    }
    return false;
  }

  async function refreshPermissions() {
    if (!token.value) return;
    try {
      const res = await fetch('http://localhost:3000/api/auth/permissions', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.value}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        permissions.value = data.permissions;
        localStorage.setItem('permissions', JSON.stringify(data.permissions));
      } else if (res.status === 401 || res.status === 403) {
        logout();
      }
    } catch (e) {
      console.error('Failed to refresh permissions', e);
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
