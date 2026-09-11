// Settings > Appearance lets the owner force reduced motion regardless of
// the OS setting (spec §6 Settings, §13). 'system' defers to the OS media
// query (usePreferredReducedMotion); 'on'/'off' override it explicitly.
const STORAGE_KEY = 'arawan:reduced-motion'

export function useReducedMotionSetting() {
  const setting = useState<'system' | 'on' | 'off'>('reduced-motion-setting', () => 'system')
  onMounted(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'on' || stored === 'off' || stored === 'system') setting.value = stored
  })
  function set(value: 'system' | 'on' | 'off') {
    setting.value = value
    localStorage.setItem(STORAGE_KEY, value)
  }
  return { setting, set }
}

export function useReducedMotion() {
  const { setting } = useReducedMotionSetting()
  const osPrefers = usePreferredReducedMotion()
  return computed(() => (setting.value === 'system' ? osPrefers.value : setting.value === 'on'))
}
