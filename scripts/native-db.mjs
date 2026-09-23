import pg from 'pg'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const command = process.argv[2] ?? 'migrate'
const adminUrl = process.env.ARAWAN_NATIVE_ADMIN_URL
const appUrl = process.env.ARAWAN_DATABASE_URL
const ownerEmail = process.env.ARAWAN_OWNER_EMAIL ?? 'owner@arawan.local'
const ownerPassword = process.env.ARAWAN_OWNER_PASSWORD ?? 'arawan-local-dev'
const ownerId = 'a0000000-0000-4000-8000-00000000a001'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function localUrl(value, name) {
  if (!value) throw new Error(`${name} is required`)
  const parsed = new URL(value)
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) throw new Error(`${name} must use a loopback host`)
  return parsed
}
function quoteIdent(value) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error(`Unsafe identifier: ${value}`)
  return `"${value}"`
}
function quoteLiteral(value) { return `'${value.replaceAll("'", "''")}'` }

async function ensureDatabase() {
  const admin = localUrl(adminUrl, 'ARAWAN_NATIVE_ADMIN_URL')
  const app = localUrl(appUrl, 'ARAWAN_DATABASE_URL')
  const dbName = decodeURIComponent(app.pathname.slice(1))
  const role = decodeURIComponent(app.username)
  const password = decodeURIComponent(app.password)
  const client = new pg.Client({ connectionString: admin.toString() })
  await client.connect()
  try {
    const roleExists = await client.query('select 1 from pg_roles where rolname = $1', [role])
    if (!roleExists.rowCount) await client.query(`create role ${quoteIdent(role)} login password ${quoteLiteral(password)}`)
    else await client.query(`alter role ${quoteIdent(role)} password ${quoteLiteral(password)}`)
    for (const apiRole of ['anon', 'authenticated', 'service_role']) {
      const apiRoleExists = await client.query('select 1 from pg_roles where rolname = $1', [apiRole])
      if (!apiRoleExists.rowCount) await client.query(`create role ${quoteIdent(apiRole)} nologin`)
    }
    await client.query(`grant authenticated to ${quoteIdent(role)}`)
    const dbExists = await client.query('select 1 from pg_database where datname = $1', [dbName])
    if (!dbExists.rowCount) await client.query(`create database ${quoteIdent(dbName)} owner ${quoteIdent(role)}`)
  } finally { await client.end() }
}

async function migrate() {
  await ensureDatabase()
  const app = new pg.Client({ connectionString: localUrl(appUrl, 'ARAWAN_DATABASE_URL').toString() })
  await app.connect()
  try {
    await app.query('create schema if not exists native_meta')
    await app.query('create table if not exists native_meta.migrations (name text primary key, applied_at timestamptz not null default now())')
    const files = [
      path.join(root, 'database/native/0000_compat.sql'),
      ...(await readdir(path.join(root, 'supabase/migrations'))).filter((file) => file.endsWith('.sql')).sort().map((file) => path.join(root, 'supabase/migrations', file)),
    ]
    for (const file of files) {
      const name = path.relative(root, file).replaceAll('\\', '/')
      const exists = await app.query('select 1 from native_meta.migrations where name = $1', [name])
      if (exists.rowCount) continue
      const sql = await readFile(file, 'utf8')
      await app.query('begin')
      try {
        await app.query(sql)
        await app.query('insert into native_meta.migrations(name) values ($1)', [name])
        await app.query('commit')
        console.log(`Applied ${name}`)
      } catch (error) { await app.query('rollback'); throw error }
    }
  } finally { await app.end() }
}

async function seed(includeFixtures = true) {
  const app = new pg.Client({ connectionString: localUrl(appUrl, 'ARAWAN_DATABASE_URL').toString() })
  await app.connect()
  try {
    await app.query(
      `insert into auth.users(id,email,encrypted_password) values ($1,$2,extensions.crypt($3, extensions.gen_salt('bf')))
       on conflict(id) do update set email=excluded.email, encrypted_password=excluded.encrypted_password, disabled_at=null, updated_at=now()`,
      [ownerId, ownerEmail, ownerPassword],
    )
    await app.query(
      `insert into public.profiles(id,timezone,currency,default_collection_weekdays)
       values ($1,'Asia/Manila','PHP','{1,2,3,4,5,6,7}') on conflict(id) do nothing`, [ownerId],
    )
    if (includeFixtures) {
      await app.query(
        `insert into public.borrowers(id,owner_id,display_name,normalized_name)
         select ('a1000000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, $1,
                'NATIVE BORROWER ' || g, 'native borrower ' || g
           from generate_series(1,30) g on conflict(id) do nothing`, [ownerId],
      )
      await app.query(
        `insert into public.loans(id,owner_id,borrower_id,source_sequence,currency,principal_centavos,daily_due_centavos,
             interest_mode,interest_centavos,total_payable_centavos,borrowed_on,payment_start_on,due_on,collection_weekdays,readiness,archived_at)
         select ('b0000000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, $1,
                ('a1000000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, g, 'PHP', 100000*g, 2000*g,
                'added'::public.loan_interest_mode, 20000*g, 120000*g,
                (now() at time zone 'Asia/Manila')::date-(g*2), (now() at time zone 'Asia/Manila')::date-(g*2),
                (now() at time zone 'Asia/Manila')::date+90, '{1,2,3,4,5,6,7}', 'ready',
                case when g=7 then now()-interval '3 days' end
           from generate_series(1,30) g on conflict(id) do nothing`, [ownerId],
      )
    }
    console.log(`Seeded native owner ${ownerEmail}${includeFixtures ? ' and fixtures' : ''}`)
  } finally { await app.end() }
}

if (command === 'init') { await migrate(); await seed(true) }
else if (command === 'migrate') await migrate()
else if (command === 'seed') await seed(true)
else if (command === 'reset-owner') await seed(false)
else throw new Error(`Unknown native database command: ${command}`)
