<script setup lang="ts">
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
</script>

<template>
  <div>
    <h1>Dashboard</h1>
    <p>Welcome to the FAI/LAB Testing System, {{ authStore.user?.full_name }}!</p>
  </div>
</template>
