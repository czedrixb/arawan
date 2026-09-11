// Builds a production bundle and boots it on a fixed port for Playwright
// (spec §14): the service worker and spaLoadingTemplate only exist in
// `.output/`, and `nuxt dev`'s per-route lazy compilation is known to
// race browser automation (observed in the sibling czed-czhan-store
// project's own e2e-server.ts).
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const PORT = 3211

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))))
  })
}

async function main() {
  await run('npx', ['nuxt', 'build'])

  const env = { ...process.env, PORT: String(PORT), HOST: '0.0.0.0' }
  const nodeArgs = []
  if (existsSync('.env')) nodeArgs.push('--env-file=.env')
  nodeArgs.push('.output/server/index.mjs')

  const server = spawn('node', nodeArgs, { stdio: 'inherit', env })
  const cleanup = () => server.kill()
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  process.on('exit', cleanup)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
