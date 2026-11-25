// Durable storage on a free hosted Postgres (Neon).
// SQLite stays the working database. Every committed write (INSERT/UPDATE/DELETE) is also appended, in order,
// to a `wal` table in Postgres. On boot, SQLite is rebuilt (schema + seed) and the log is replayed on top.
// Without DATABASE_URL nothing changes (plain SQLite).
const crypto = require('crypto');
module.exports = function install(db) {
  const url = process.env.DATABASE_URL;
  if (!url) { db.ready = Promise.resolve(); db.flush = () => Promise.resolve(); return db; }

  let pool;
  if (process.env.WAL_TEST_PGLITE) {
    const { PGlite } = require('@electric-sql/pglite'); const pg = new PGlite(process.env.WAL_TEST_PGLITE === '1' ? undefined : process.env.WAL_TEST_PGLITE);
    pool = { query: (t, p) => pg.query(t, p) };
  } else {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 20000, connectionTimeoutMillis: 20000, ssl: /sslmode=disable|localhost/.test(url) ? false : { rejectUnauthorized: false } });
    pool.on('error', e => console.error('pg pool', e.message));
  }
  const origin = crypto.randomBytes(4).toString('hex');
  const rawPrepare = db.prepare.bind(db), rawTx = db.transaction.bind(db);
  const enc = a => a.map(x => Buffer.isBuffer(x) ? { $b: x.toString('base64') } : x === undefined ? null : x);
  const dec = a => a.map(x => x && typeof x === 'object' && '$b' in x ? Buffer.from(x.$b, 'base64') : x);

  const queue = []; let pending = [], depth = 0, mark = 0, pumping = false, waiters = [], replaying = true;
  const log = (sql, args, rid) => { const e = { sql, params: JSON.stringify(enc(args)), rid: rid == null ? null : String(rid) }; if (depth > 0) pending.push(e); else enqueue([e]); };
  function enqueue(es) { if (replaying) return; queue.push(...es); pump(); }
  async function pump() {
    if (pumping) return; pumping = true;
    try {
      while (queue.length) {
        const batch = queue.slice(0, 100);
        try {
          await pool.query('INSERT INTO wal(origin,sql,params,rid) SELECT $4, s, p::jsonb, r FROM unnest($1::text[],$2::text[],$3::bigint[]) WITH ORDINALITY AS t(s,p,r,o) ORDER BY o',
            [batch.map(b => b.sql), batch.map(b => b.params), batch.map(b => b.rid), origin]);
          queue.splice(0, batch.length);
        } catch (e) { console.error('wal write failed, retrying:', e.message); await new Promise(r => setTimeout(r, 2000)); }
      }
    } finally { pumping = false; const w = waiters; waiters = []; w.forEach(f => f()); }
  }
  db.flush = (ms = 10000) => queue.length || pumping ? new Promise(res => { const t = setTimeout(res, ms); waiters.push(() => { clearTimeout(t); res(); }); }) : Promise.resolve();

  db.prepare = sql => {
    const st = rawPrepare(sql);
    if (!/^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql)) return st;
    return new Proxy(st, { get(t, p) {
      if (p === 'run') return (...a) => { const r = t.run(...a); log(sql, a, /^\s*(INSERT|REPLACE)/i.test(sql) ? r.lastInsertRowid : null); return r; };
      const v = t[p]; return typeof v === 'function' ? v.bind(t) : v;
    } });
  };
  db.transaction = fn => {
    const real = rawTx(fn);
    return (...a) => {
      if (depth === 0) { pending = []; }
      depth++; let r;
      try { r = real(...a); } catch (e) { depth--; if (depth === 0) pending = []; throw e; }
      depth--; if (depth === 0) { const p = pending; pending = []; enqueue(p); }
      return r;
    };
  };

  db.ready = (async () => {
    let last;
    for (let i = 0; i < 12; i++) {
      try {
        await pool.query('CREATE TABLE IF NOT EXISTS wal(id BIGSERIAL PRIMARY KEY, at TIMESTAMPTZ DEFAULT now(), origin TEXT, sql TEXT NOT NULL, params JSONB NOT NULL, rid BIGINT)');
        let from = 0, n = 0, bad = 0, drift = 0;
        for (;;) {
          const r = await pool.query('SELECT id, sql, params, rid FROM wal WHERE id > $1 ORDER BY id LIMIT 500', [from]);
          if (!r.rows.length) break;
          rawTx(() => { for (const row of r.rows) {
            try { const x = rawPrepare(row.sql).run(...dec(row.params)); if (row.rid != null && /^\s*(INSERT|REPLACE)/i.test(row.sql) && String(x.lastInsertRowid) !== String(row.rid)) drift++; }
            catch (e) { bad++; console.error('wal replay skip', row.id, e.message); }
            from = Number(row.id); n++; } })();
        }
        replaying = false;
        console.log(`wal: replayed ${n} statements (${bad} skipped, ${drift} id drift)`);
        return;
      } catch (e) { last = e; console.error('wal connect/replay failed:', e.message); await new Promise(r => setTimeout(r, 5000)); }
    }
    console.error('wal: giving up, database unavailable:', last && last.message); process.exit(1);
  })();
  const bye = () => db.flush(8000).then(() => process.exit(0)); process.on('SIGTERM', bye); process.on('SIGINT', bye);
  return db;
};
