<template>
  <div>
    <h1 class="mb-6 text-center text-xl font-semibold text-text-primary">Set a new password</h1>
    <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
      <div>
        <label for="new-password" class="mb-1 block text-sm font-medium text-text-primary">New password</label>
        <input
          id="new-password"
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          minlength="8"
          required
          class="w-full rounded-control border border-control-border px-3 py-2.5 text-base"
        />
      </div>
      <p v-if="error" role="alert" class="text-sm text-danger-fg">{{ error }}</p>
      <p v-if="success" role="status" class="text-sm text-success-fg">Password updated. Redirecting…</p>
      <button type="submit" :disabled="submitting" class="press rounded-control bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {{ submitting ? 'Saving…' : 'Save password' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
// Supabase's redirect callback for password recovery (spec §6 auth
// callback route). @nuxtjs/supabase detects the recovery token in the
// URL and updates the session before this page's setup runs.
definePageMeta({ layout: 'auth' })

const newPassword = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)
const success = ref(false)
const client = useSupabaseClient()

async function onSubmit() {
  submitting.value = true
  error.value = null
  const { error: updateError } = await client.auth.updateUser({ password: newPassword.value })
  submitting.value = false
  if (updateError) {
    error.value = updateError.message
    return
  }
  success.value = true
  setTimeout(() => navigateTo('/'), 1200)
}
</script>
