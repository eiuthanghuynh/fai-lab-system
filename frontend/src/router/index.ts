import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LoginView from '../views/LoginView.vue'
import MainLayout from '../layouts/MainLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('../views/ResetPasswordView.vue'),
    },
    {
      path: '/',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          meta: { permission: ['VIEW_DASHBOARD_FAI', 'VIEW_DASHBOARD_LAB'] },
          component: () => import('../views/DashboardView.vue'),
        },
        {
          path: 'admin/users',
          name: 'admin-users',
          meta: { permission: 'ADMINISTRATOR' },
          component: () => import('../views/admin/UserManagementView.vue'),
        },
        {
          path: 'admin/roles',
          name: 'admin-roles',
          meta: { permission: 'ADMINISTRATOR' },
          component: () => import('../views/admin/RoleManagementView.vue'),
        },
        {
          path: 'admin/fai-failure-modes',
          name: 'admin-fai-failure-modes',
          meta: { permission: 'ADMINISTRATOR' },
          component: () => import('../views/admin/FaiFailureModeManagementView.vue'),
        },
        {
          path: 'admin/commodity-parts',
          name: 'admin-commodity-parts',
          meta: { permission: 'ADMINISTRATOR' },
          component: () => import('../views/admin/CommodityPartManagementView.vue'),
        },
        {
          path: 'admin/suppliers',
          name: 'admin-suppliers',
          meta: { permission: 'ADMINISTRATOR' },
          component: () => import('../views/admin/SupplierManagementView.vue'),
        },
        {
          path: 'admin/item-tests',
          name: 'admin-item-tests',
          meta: { permission: 'ADMINISTRATOR' },
          component: () => import('../views/admin/ItemTestManagementView.vue'),
        },
        {
          path: 'unauthorized',
          name: 'unauthorized',
          component: () => import('../views/UnauthorizedView.vue'),
        },
        {
          path: 'fai/request/create',
          name: 'fai-request-create',
          meta: { permission: 'SUBMIT_FAI_REQUEST' },
          component: () => import('../views/fai/CreateRequestView.vue'),
        },
        {
          path: 'fai/request/list',
          name: 'fai-request-list',
          meta: { permission: ['SUBMIT_FAI_REQUEST', 'MANAGE_REQUEST_LIST'] },
          component: () => import('../views/fai/RequestListView.vue'),
        },
        {
          path: 'fai/request/:id',
          name: 'fai-request-detail',
          meta: { permission: ['SUBMIT_FAI_REQUEST', 'MANAGE_REQUEST_LIST'] },
          component: () => import('../views/fai/RequestDetailView.vue'),
        },
        {
          path: 'lab/request/list',
          name: 'lab-request-list',
          component: () => import('../views/lab/RequestListView.vue'),
          meta: { permission: ['SUBMIT_LAB_REQUEST', 'ASSIGN_LAB', 'INSPECT_LAB'] }
        },
        {
          path: 'lab/request/create',
          name: 'lab-request-create',
          component: () => import('../views/lab/CreateRequestView.vue'),
          meta: { permission: 'SUBMIT_LAB_REQUEST' }
        },
        {
          path: 'lab/request/:id',
          name: 'lab-request-detail',
          component: () => import('../views/lab/RequestDetailView.vue')
        },
        {
          path: '/:pathMatch(.*)*',
          name: 'not-found',
          component: () => import('../views/NotFoundView.vue'),
        },
      ],
    },

  ],
})

router.beforeEach(async (to, from) => {
  const authStore = useAuthStore()

  // If logged in and navigating to a permission-gated page, sync permissions with backend first
  if (authStore.isAuthenticated && to.meta.permission) {
    try {
      await authStore.refreshPermissions()
    } catch (err) {
      console.error('Failed to sync permissions on navigation:', err)
    }
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  } else if (to.name === 'login' && authStore.isAuthenticated) {
    return { name: 'home' }
  } else if (to.meta.permission) {
    const requiredPermissions = Array.isArray(to.meta.permission)
      ? to.meta.permission
      : [to.meta.permission];
    const hasAny = requiredPermissions.some(perm => authStore.hasPermission(perm as string));
    if (!hasAny) {
      return { name: 'unauthorized' }
    } else {
      return true
    }
  } else {
    return true
  }
})

export default router
