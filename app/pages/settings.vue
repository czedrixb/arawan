<template>
  <div>
    <PageHeader title="Settings" />
    <div class="mt-4 flex flex-col gap-6 px-4 pb-12 lg:px-8">
      <section class="rounded-card border border-border bg-surface p-4 shadow-card">
        <h2 class="mb-3 text-sm font-semibold text-text-primary">Account</h2>
        <p class="text-sm text-text-secondary">{{ user?.email }}</p>
        <button type="button" class="press mt-3 rounded-control border border-control-border px-4 py-2 text-sm font-medium" @click="onSignOut">
          Sign out
        </button>
      </section>

      <section class="rounded-card border border-border bg-surface p-4 shadow-card">
        <h2 class="mb-3 text-sm font-semibold text-text-primary">Currency &amp; timezone</h2>
        <p class="text-sm text-text-secondary">{{ profile?.currency ?? 'PHP' }} · {{ profile?.timezone ?? 'Asia/Manila' }}</p>
      </section>

      <section class="rounded-card border border-border bg-surface p-4 shadow-card">
        <h2 class="mb-3 text-sm font-semibold text-text-primary">Default collection days</h2>
        <p class="mb-2 text-xs text-text-secondary">Applies to loans created from now on -- existing loans are unaffected.</p>
        <div class="flex gap-1">
          <button
            v-for="d in weekdayLabels"
            :key="d.value"
            type="button"
            class="press h-9 w-9 rounded-full border text-xs"
            :class="defaultWeekdays.includes(d.value) ? 'border-primary bg-primary text-white' : 'border-control-border'"
            @click="toggleDefaultWeekday(d.value)"
          >
            {{ d.label }}
          </button>
        </div>
        <button type="button" class="press mt-3 rounded-control border border-control-border px-4 py-2 text-sm font-medium" @click="saveDefaults">
          Save defaults
        </button>
      </section>

      <section class="rounded-card border border-border bg-surface p-4 shadow-card">
        <h2 class="mb-3 text-sm font-semibold text-text-primary">Appearance</h2>
        <label class="mb-1 block text-sm text-text-secondary">Motion</label>
        <select v-model="motionSetting" class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" @change="setMotion(motionSetting)">
          <option value="system">Match system</option>
          <option value="on">Reduce motion</option>
          <option value="off">Full motion</option>
        </select>
      </section>

      <section class="rounded-card border border-border bg-surface p-4 shadow-card">
        <h2 class="mb-3 text-sm font-semibold text-text-primary">Install ARAWAN</h2>
        <p v-if="installed" class="text-sm text-success-fg">Installed.</p>
        <button v-else-if="canPrompt" type="button" class="press rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white" @click="promptInstall">
          Install
        </button>
        <p v-else-if="isIos" class="text-sm text-text-secondary">
          On iPhone/iPad: tap the Share icon, then "Add to Home Screen".
        </p>
        <p v-else class="text-sm text-text-secondary">Your browser doesn't support installing this app directly yet.</p>
      </section>

      <section v-if="needRefresh" class="rounded-card border border-primary bg-accent-soft p-4">
        <p class="mb-2 text-sm text-text-primary">An update is available.</p>
        <button type="button" class="press rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white" @click="onUpdate">
          Update now
        </button>
      </section>

      <section class="rounded-card border border-border bg-surface p-4 shadow-card">
        <h2 class="mb-2 text-sm font-semibold text-text-primary">Backup &amp; export</h2>
        <p class="text-sm text-text-secondary">
          Excel export is coming in a follow-up update. Your data lives in Supabase Postgres -- ask your database
          administrator about backup/restore policy for the linked project.
        </p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
const user = useSupabaseUser()
const client = useSupabaseClient()
const { setting: motionSetting, set: setMotion } = useReducedMotionSetting()
const { canPrompt, isIos, installed, promptInstall } = useInstallPrompt()
const { needRefresh, updateNow } = usePwa()

const { data: profile } = await useAsyncData<Profile | null>('profile', async () => {
  const { data } = await client.from('profiles').select('*').single()
  return data
})

const defaultWeekdays = ref<number[]>(profile.value?.default_collection_weekdays ?? [1, 2, 3, 4, 5, 6, 7])
watch(profile, (p) => {
  if (p) defaultWeekdays.value = p.default_collection_weekdays
})
const weekdayLabels = [
  { value: 1, label: 'M' },
  { value: 2, label: 'T' },
  { value: 3, label: 'W' },
  { value: 4, label: 'T' },
  { value: 5, label: 'F' },
  { value: 6, label: 'S' },
  { value: 7, label: 'S' },
]
function toggleDefaultWeekday(day: number) {
  defaultWeekdays.value = defaultWeekdays.value.includes(day)
    ? defaultWeekdays.value.filter((d) => d !== day)
    : [...defaultWeekdays.value, day].sort()
}
async function saveDefaults() {
  // `Database` is a stub (app/types/database.types.ts) until `supabase gen
  // types` runs against the linked project, which makes typed-client
  // writes resolve to `never`; cast until real types are generated.
  await client.from('profiles').update({ default_collection_weekdays: defaultWeekdays.value } as never).eq('id', user.value!.id)
  useToast().show('Defaults saved')
}

async function onSignOut() {
  await client.auth.signOut()
  // Full reload, not an SPA navigation -- guarantees no user-scoped
  // client state survives sign-out (spec §12).
  window.location.href = '/login'
}

async function onUpdate() {
  const updated = await updateNow()
  if (!updated) useToast().show('Finish or close any open form first', 'info')
}
</script>
