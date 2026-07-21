<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAsyncState } from '@vueuse/core';
import BaseModal from '@/components/common/BaseModal.vue';
import Button from '@/components/ui/Button.vue';
import SingleSelectDropdown from '@/components/common/SingleSelectDropdown.vue';
import Textarea from '@/components/ui/Textarea.vue';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';

interface ApprovalLog {
  id: number;
  role?: string | null;
  action: 'Approved' | 'Rejected';
  comment?: string | null;
  created_at: string;
  approver: {
    id: number;
    full_name: string;
  };
}

const props = defineProps<{
  isOpen: boolean;
  requestId: number;
  approvalLogs?: ApprovalLog[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const { t } = useI18n();
const authStore = useAuthStore();

// Form states
const selectedRole = ref<'APPROVE_LAB_ENGINEER' | 'APPROVE_LAB_MANAGER'>('APPROVE_LAB_ENGINEER');
const action = ref<'Approved' | 'Rejected' | ''>('');
const comment = ref('');
const errorMessage = ref('');

// Options for status dropdown
const statusOptions = computed(() => [
  { label: t('approval.lab.approved'), value: 'Approved' },
  { label: t('approval.lab.rejected'), value: 'Rejected' },
]);

// Helper to check permission
const canApproveEngineer = computed(() => 
  authStore.user?.permissions?.includes('APPROVE_LAB_ENGINEER') ?? false
);
const canApproveManager = computed(() => 
  authStore.user?.permissions?.includes('APPROVE_LAB_MANAGER') ?? false
);

// Find existing log for Engineer
const engineerLog = computed(() => {
  if (!props.approvalLogs) return null;
  return props.approvalLogs.find((log) => log.role === 'APPROVE_LAB_ENGINEER');
});

// Find existing log for Manager
const managerLog = computed(() => {
  if (!props.approvalLogs) return null;
  return props.approvalLogs.find((log) => log.role === 'APPROVE_LAB_MANAGER');
});

// Determine active editable role based on user permissions & pending status
const activeUserRole = computed<'APPROVE_LAB_ENGINEER' | 'APPROVE_LAB_MANAGER' | null>(() => {
  if (canApproveEngineer.value && !engineerLog.value) {
    return 'APPROVE_LAB_ENGINEER';
  }
  if (canApproveManager.value && !managerLog.value) {
    return 'APPROVE_LAB_MANAGER';
  }
  if (canApproveEngineer.value) return 'APPROVE_LAB_ENGINEER';
  if (canApproveManager.value) return 'APPROVE_LAB_MANAGER';
  return null;
});

watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      errorMessage.value = '';
      action.value = '';
      comment.value = '';
      if (activeUserRole.value) {
        selectedRole.value = activeUserRole.value;
      }
    }
  }
);

watch(selectedRole, () => {
  action.value = '';
  comment.value = '';
  errorMessage.value = '';
});

const { isLoading: isSubmitting, execute: submitApproval } = useAsyncState(
  async () => {
    errorMessage.value = '';

    if (!selectedRole.value) {
      errorMessage.value = t('approval.lab.approval_error');
      return;
    }

    if (!action.value) {
      errorMessage.value = t('approval.lab.select_status');
      return;
    }

    if (action.value === 'Rejected' && !comment.value.trim()) {
      errorMessage.value = t('approval.lab.explanation_required');
      return;
    }

    try {
      const res = await api.post(`/lab/requests/${props.requestId}/approve`, {
        role: selectedRole.value,
        action: action.value,
        comment: comment.value.trim(),
      });

      if (res.data.success) {
        emit('success');
        emit('close');
      } else {
        errorMessage.value = res.data.error || t('approval.lab.approval_error');
      }
    } catch (err: any) {
      errorMessage.value = err.response?.data?.error || t('approval.lab.approval_error');
    }
  },
  null,
  { immediate: false }
);

const handleClose = () => {
  emit('close');
};
</script>

<template>
  <BaseModal
    :isOpen="isOpen"
    :title="t('approval.lab.approval_modal_title')"
    maxWidth="650px"
    @close="handleClose"
  >
    <div class="space-y-6">
      <div v-if="errorMessage" class="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
        {{ errorMessage }}
      </div>

      <!-- Role Selector (Only shown if user has both permissions and both are pending) -->
      <div v-if="canApproveEngineer && canApproveManager && !engineerLog && !managerLog" class="p-4 rounded-lg border border-border bg-bg-surface/50 flex items-center justify-between">
        <label class="text-sm font-semibold text-text">
          {{ t('approval.lab.approval_role_select', 'Acting Approval Role:') }}
        </label>
        <div class="flex gap-6">
          <label class="flex items-center gap-2 text-sm text-text cursor-pointer font-medium">
            <input type="radio" v-model="selectedRole" value="APPROVE_LAB_ENGINEER" class="accent-primary h-4 w-4" />
            {{ t('approval.lab.lab_engineer_approval') }}
          </label>
          <label class="flex items-center gap-2 text-sm text-text cursor-pointer font-medium">
            <input type="radio" v-model="selectedRole" value="APPROVE_LAB_MANAGER" class="accent-primary h-4 w-4" />
            {{ t('approval.lab.quality_manager_approval') }}
          </label>
        </div>
      </div>

      <!-- Section 1: Lab Engineer Approval -->
      <div class="p-4 rounded-lg border border-border bg-bg-surface/50">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold text-text m-0">
            {{ t('approval.lab.lab_engineer_approval') }}
          </h3>
          <span
            v-if="engineerLog"
            :class="[
              'px-2.5 py-0.5 rounded text-xs font-semibold',
              engineerLog.action === 'Approved' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
            ]"
          >
            {{ engineerLog.action === 'Approved' ? t('approval.lab.already_approved') : t('approval.lab.already_rejected') }}
            ({{ engineerLog.approver.full_name }})
          </span>
          <span v-else class="text-xs text-text-muted italic">
            {{ t('approval.lab.pending') }}
          </span>
        </div>

        <template v-if="engineerLog">
          <div class="text-sm text-text-muted">
            <p v-if="engineerLog.comment" class="mt-1 mb-0 italic">
              "{{ engineerLog.comment }}"
            </p>
          </div>
        </template>
        <template v-else-if="canApproveEngineer && selectedRole === 'APPROVE_LAB_ENGINEER'">
          <div class="grid grid-cols-[1fr_2fr] gap-4 items-center mb-3">
            <label class="text-sm font-medium text-text">
              {{ t('approval.lab.approval_status') }} <span class="text-danger">*</span>
            </label>
            <SingleSelectDropdown
              v-model="action"
              :options="statusOptions"
              :placeholder="t('approval.lab.select_status')"
            />
          </div>
          <div class="grid grid-cols-[1fr_2fr] gap-4 items-start">
            <label class="text-sm font-medium text-text pt-2">
              {{ t('approval.lab.explanation') }}
              <span v-if="action === 'Rejected'" class="text-danger">*</span>
            </label>
            <Textarea
              v-model="comment"
              :placeholder="t('approval.lab.explanation_placeholder')"
              class="w-full"
            />
          </div>
        </template>
        <template v-else>
          <p class="text-xs text-text-muted m-0 italic">
            {{ t('approval.lab.no_permission', 'You do not have permission or this section is not active.') }}
          </p>
        </template>
      </div>

      <!-- Section 2: Quality Manager Approval -->
      <div class="p-4 rounded-lg border border-border bg-bg-surface/50">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold text-text m-0">
            {{ t('approval.lab.quality_manager_approval') }}
          </h3>
          <span
            v-if="managerLog"
            :class="[
              'px-2.5 py-0.5 rounded text-xs font-semibold',
              managerLog.action === 'Approved' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
            ]"
          >
            {{ managerLog.action === 'Approved' ? t('approval.lab.already_approved') : t('approval.lab.already_rejected') }}
            ({{ managerLog.approver.full_name }})
          </span>
          <span v-else class="text-xs text-text-muted italic">
            {{ t('approval.lab.pending') }}
          </span>
        </div>

        <template v-if="managerLog">
          <div class="text-sm text-text-muted">
            <p v-if="managerLog.comment" class="mt-1 mb-0 italic">
              "{{ managerLog.comment }}"
            </p>
          </div>
        </template>
        <template v-else-if="canApproveManager && selectedRole === 'APPROVE_LAB_MANAGER'">
          <div class="grid grid-cols-[1fr_2fr] gap-4 items-center mb-3">
            <label class="text-sm font-medium text-text">
              {{ t('approval.lab.approval_status') }} <span class="text-danger">*</span>
            </label>
            <SingleSelectDropdown
              v-model="action"
              :options="statusOptions"
              :placeholder="t('approval.lab.select_status')"
            />
          </div>
          <div class="grid grid-cols-[1fr_2fr] gap-4 items-start">
            <label class="text-sm font-medium text-text pt-2">
              {{ t('approval.lab.explanation') }}
              <span v-if="action === 'Rejected'" class="text-danger">*</span>
            </label>
            <Textarea
              v-model="comment"
              :placeholder="t('approval.lab.explanation_placeholder')"
              class="w-full"
            />
          </div>
        </template>
        <template v-else>
          <p class="text-xs text-text-muted m-0 italic">
            {{ t('approval.lab.no_permission', 'You do not have permission or this section is not active.') }}
          </p>
        </template>
      </div>
    </div>

    <template #footer>
      <Button variant="secondary" @click="handleClose">
        {{ t('common.cancel') }}
      </Button>

      <Button
        v-if="activeUserRole"
        variant="primary"
        :loading="isSubmitting"
        @click="submitApproval"
      >
        {{ t('approval.lab.submit_approval') }}
      </Button>
    </template>
  </BaseModal>
</template>
