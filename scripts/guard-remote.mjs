// Every npm script that shells out to the Supabase CLI routes through this
// wrapper. `supabase/.temp/linked-project.json` links this repo to the
// PRODUCTION project, and a bare `supabase db push` (or `link`, or anything
// carrying `--linked`/`--project-ref`) targets that link with no further
// confirmation. This script refuses those unless ARAWAN_ALLOW_PROD=1 is set,
// so the accident has to be opted into explicitly instead of being the
// default behavior of `npm run db:push`.
//
// Usage: node scripts/guard-remote.mjs <supabase CLI args...>
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)

// Subcommands whose default target (no --local given) is the linked remote
// project. `db reset`, `migration up`, `db diff`, and `gen types ... --local`
// all default to the LOCAL stack and are deliberately not listed here.
const REMOTE_BY_DEFAULT = ['db push', 'db pull', 'db dump', 'db lint', 'link']

function blockReason(list) {
  if (list.includes('--linked')) return '--linked'
  const projectRef = list.find((a) => a === '--project-ref' || a.startsWith('--project-ref='))
  if (projectRef) return projectRef
  if (list.includes('--local')) return null
  const words = list.filter((a) => !a.startsWith('-'))
  const first = words[0]
  const firstTwo = words.slice(0, 2).join(' ')
  const hit = REMOTE_BY_DEFAULT.find((s) => s === first || s === firstTwo)
  return hit ? `\`supabase ${hit}\` (targets the linked project by default)` : null
}

const reason = blockReason(args)
if (reason && process.env.ARAWAN_ALLOW_PROD !== '1') {
  console.error(
    `\n[guard-remote] REFUSED: ${reason}\n` +
    'This repo is linked to the PRODUCTION Supabase project ' +
    '(supabase/.temp/linked-project.json). Local development should use ' +
    '`npm run db:start` / `npm run db:reset`, which never touch it.\n' +
    'If you genuinely mean to run this against production, re-run with ' +
    'ARAWAN_ALLOW_PROD=1 set.\n',
  )
  process.exit(1)
}

const result = spawnSync('supabase', args, { stdio: 'inherit', shell: process.platform === 'win32' })
process.exit(result.status ?? 1)
