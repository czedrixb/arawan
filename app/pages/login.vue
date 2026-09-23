<template>
  <div>
    <h1 class="mb-6 text-center text-xl font-semibold text-text-primary">Sign in</h1>
    <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
      <div>
        <label for="email" class="mb-1 block text-sm font-medium text-text-primary">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          autocomplete="email"
          required
          class="w-full rounded-control border border-control-border px-3 py-2.5 text-base"
        />
      </div>
      <div>
        <label for="password" class="mb-1 block text-sm font-medium text-text-primary">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          class="w-full rounded-control border border-control-border px-3 py-2.5 text-base"
        />
      </div>
      <p v-if="error" role="alert" class="text-sm text-danger-fg">{{ error }}</p>
      <button
        type="submit"
        :disabled="submitting"
        class="press rounded-control bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {{ submitting ? 'Signing in…' : 'Sign in' }}
      </button>
      <button type="button" class="text-sm text-text-secondary underline" @click="onForgotPassword">
        Forgot password?
      </button>
      <p v-if="recoverySent" class="text-sm text-success-fg" role="status">Password reset email sent.</p>
    </form>
  </div>
</template>

<script setup lang="ts">
// Single-owner email/password sign-in (spec §6 Settings/auth). No
// borrower data ever renders on this page or the launch screen.
definePageMeta({ layout: 'auth' })

const email = ref('')
const password = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)
const recoverySent = ref(false)

const route = useRoute()

async function onSubmit() {
  submitting.value = true
  error.value = null
  try {
    await signInArawan(email.value, password.value)
  } catch {
    submitting.value = false
    error.value = 'Incorrect email or password.'
    return
  }
  submitting.value = false
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  await navigateTo(redirect)
}

async function onForgotPassword() {
  if (!email.value) {
    error.value = 'Enter your email above first.'
    return
  }
  if (useRuntimeConfig().public.backendMode === 'native-postgres') {
    error.value = 'Use npm run db:native:reset-owner to reset the local password.'
    return
  }
  const { error: resetError } = await useSupabaseClient().auth.resetPasswordForEmail(email.value, {
    redirectTo: `${window.location.origin}/confirm`,
  })
  if (!resetError) recoverySent.value = true
}
</script>
