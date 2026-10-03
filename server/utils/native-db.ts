import pg from 'pg'
import type { PoolClient, QueryResult } from 'pg'

pg.types.setTypeParser(20, Number)

let pool: pg.Pool | undefined

function databaseUrl() {
  const url = useRuntimeConfig().databaseUrl
  if (!url) throw new Error('ARAWAN_DATABASE_URL is required in native-postgres mode')
  const parsed = new URL(url)
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
    throw new Error('Native PostgreSQL mode only accepts a loopback database URL')
  }
  return url
}

export function nativePool() {
  return (pool ??= new pg.Pool({ connectionString: databaseUrl(), max: 8 }))
}

export async function withNativeClient<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await nativePool().connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

export async function withNativeOwner<T>(ownerId: string, fn: (client: PoolClient) => Promise<T>) {
  return withNativeClient(async (client) => {
    await client.query('begin')
    try {
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [ownerId])
      const result = await fn(client)
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  })
}

const TABLES = new Set(['profiles', 'borrowers', 'loans', 'loan_summary', 'loan_renewals', 'payment_entries', 'opening_balances', 'audit_events'])
const FUNCTIONS = new Set(['record_payment', 'reverse_payment', 'confirm_opening_balance', 'edit_loan_record', 'renew_loan'])
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/

type Filter = { kind: 'eq' | 'is' | 'notIs' | 'gte' | 'lte' | 'ilike' | 'in'; column: string; value: unknown }

export class NativeSupabaseClient {
  constructor(private ownerId: string) {}
  from(table: string) {
    if (!TABLES.has(table)) throw new Error(`Unsupported native table: ${table}`)
    return new NativeQuery(this.ownerId, table)
  }
  async rpc(name: string, args: Record<string, unknown>) {
    if (!FUNCTIONS.has(name)) return { data: null, error: new Error(`Unsupported native RPC: ${name}`) }
    const entries = Object.entries(args)
    if (entries.some(([key]) => !IDENTIFIER.test(key))) return { data: null, error: new Error('Invalid RPC argument') }
    try {
      const result = await withNativeOwner(this.ownerId, (client) =>
        client.query(`select * from public.${name}(${entries.map(([key], i) => `${key} => $${i + 1}${key === 'p_collection_weekdays' ? '::smallint[]' : ''}`).join(', ')})`, entries.map(([, value]) => value)),
      )
      const row = result.rows[0] ?? null
      // Scalar-returning RPCs (such as renew_loan's jsonb response) come
      // back from pg as { function_name: value }; PostgREST returns value.
      const data = row && Object.keys(row).length === 1 && Object.hasOwn(row, name) ? row[name] : row
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }
}

class NativeQuery implements PromiseLike<any> {
  private operation: 'select' | 'insert' | 'update' = 'select'
  private columns = '*'
  private values: Record<string, unknown> | Record<string, unknown>[] = {}
  private filters: Filter[] = []
  private orders: { column: string; ascending: boolean; nullsFirst?: boolean }[] = []
  private from?: number
  private to?: number
  private countMode = false
  private head = false
  private cardinality: 'many' | 'single' | 'maybeSingle' = 'many'

  constructor(private ownerId: string, private table: string) {}
  select(columns = '*', opts: { count?: string; head?: boolean } = {}) { this.columns = columns; this.countMode = opts.count === 'exact'; this.head = !!opts.head; return this }
  insert(values: Record<string, unknown> | Record<string, unknown>[]) { this.operation = 'insert'; this.values = values; return this }
  update(values: Record<string, unknown>) { this.operation = 'update'; this.values = values; return this }
  eq(column: string, value: unknown) { this.filters.push({ kind: 'eq', column, value }); return this }
  is(column: string, value: unknown) { this.filters.push({ kind: 'is', column, value }); return this }
  not(column: string, operator: string, value: unknown) { if (operator !== 'is') throw new Error('Only not-is is supported'); this.filters.push({ kind: 'notIs', column, value }); return this }
  gte(column: string, value: unknown) { this.filters.push({ kind: 'gte', column, value }); return this }
  lte(column: string, value: unknown) { this.filters.push({ kind: 'lte', column, value }); return this }
  ilike(column: string, value: unknown) { this.filters.push({ kind: 'ilike', column, value }); return this }
  in(column: string, value: unknown[]) { this.filters.push({ kind: 'in', column, value }); return this }
  order(column: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}) { this.orders.push({ column, ascending: opts.ascending !== false, nullsFirst: opts.nullsFirst }); return this }
  range(from: number, to: number) { this.from = from; this.to = to; return this }
  single() { this.cardinality = 'single'; return this }
  maybeSingle() { this.cardinality = 'maybeSingle'; return this }
  then(resolve: (value: any) => any, reject?: (reason: unknown) => any) { return this.execute().then(resolve, reject) }

  private ident(value: string) {
    if (!IDENTIFIER.test(value)) throw new Error(`Invalid SQL identifier: ${value}`)
    return `"${value}"`
  }
  private selectedColumns() {
    if (this.columns === '*') return '*'
    return this.columns.split(',').map((column) => this.ident(column.trim())).join(', ')
  }
  private where(params: unknown[]) {
    return this.filters.map((filter) => {
      const column = this.ident(filter.column)
      if (filter.kind === 'is') return `${column} is ${filter.value === null ? 'null' : 'not null'}`
      if (filter.kind === 'notIs') return `${column} is not ${filter.value === null ? 'null' : 'not null'}`
      if (filter.kind === 'in') {
        const values = filter.value as unknown[]
        if (!values.length) return 'false'
        const slots = values.map((value) => { params.push(value); return `$${params.length}` })
        return `${column} in (${slots.join(', ')})`
      }
      params.push(filter.value)
      const op = { eq: '=', gte: '>=', lte: '<=', ilike: 'ilike' }[filter.kind]
      return `${column} ${op} $${params.length}`
    }).join(' and ')
  }

  private async execute() {
    try {
      const result = await withNativeOwner(this.ownerId, async (client) => {
        const params: unknown[] = []
        let sql: string
        if (this.operation === 'select') {
          const where = this.where(params)
          const countColumn = this.countMode && !this.head ? ', count(*) over()::int as __total_count' : ''
          sql = `select ${this.head ? '1' : this.selectedColumns()}${countColumn} from public.${this.ident(this.table)}`
          if (where) sql += ` where ${where}`
          if (this.orders.length) sql += ` order by ${this.orders.map((o) => `${this.ident(o.column)} ${o.ascending ? 'asc' : 'desc'}${o.nullsFirst === false ? ' nulls last' : ''}`).join(', ')}`
          if (this.from !== undefined && this.to !== undefined) { params.push(this.to - this.from + 1, this.from); sql += ` limit $${params.length - 1} offset $${params.length}` }
          if (this.head && this.countMode) {
            sql = `select count(*)::int as count from public.${this.ident(this.table)}${where ? ` where ${where}` : ''}`
          }
        } else {
          const rows = Array.isArray(this.values) ? this.values : [this.values]
          const keys = Object.keys(rows[0] ?? {})
          if (!keys.length) throw new Error('No values supplied')
          if (this.operation === 'insert') {
            const groups = rows.map((row) => `(${keys.map((key) => { params.push(row[key]); return `$${params.length}` }).join(', ')})`)
            sql = `insert into public.${this.ident(this.table)} (${keys.map((key) => this.ident(key)).join(', ')}) values ${groups.join(', ')}`
          } else {
            const assignments = keys.map((key) => { params.push((rows[0] as Record<string, unknown>)[key]); return `${this.ident(key)} = $${params.length}` })
            const updateWhere = this.where(params)
            sql = `update public.${this.ident(this.table)} set ${assignments.join(', ')}${updateWhere ? ` where ${updateWhere}` : ''}`
          }
          sql += ` returning ${this.selectedColumns()}`
        }
        return client.query(sql, params)
      })
      const rawRows = result.rows as Record<string, unknown>[]
      const count = this.head ? Number(rawRows[0]?.count ?? 0) : this.countMode ? Number(rawRows[0]?.__total_count ?? 0) : null
      const rows = this.head ? [] : rawRows.map(({ __total_count: _count, ...row }) => row)
      if (this.cardinality === 'single' && rows.length !== 1) throw new Error(`Expected one row, received ${rows.length}`)
      const data = this.cardinality === 'many' ? rows : rows[0] ?? null
      return { data, error: null, count }
    } catch (error) {
      return { data: null, error, count: null }
    }
  }
}
