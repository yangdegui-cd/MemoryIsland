import { Miniflare } from 'miniflare';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const data = process.env.DATA_DIR || '/data';
const root = path.resolve('dist/server');
const files = await readdir(root, { recursive: true });
const modules = ['index.js', ...files.filter(n=>n.endsWith('.js') && n!=='index.js')].map(name=>({type:'ESModule',path:path.join(root,name)}));
const runtime = new Miniflare({
  name: 'daily-island', host: '0.0.0.0', port: 8787,
  modules, modulesRoot: root,
  compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'],
  d1Databases: { DB: 'daily-island-db' }, d1Persist: path.join(data,'d1'),
  r2Buckets: { BUCKET: 'daily-island-photos' }, r2Persist: path.join(data,'r2'),
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  cf: false,
});
await runtime.ready;
const db = await runtime.getD1Database('DB');
await db.prepare('CREATE TABLE IF NOT EXISTS deployment_migrations (name TEXT PRIMARY KEY)').run();
for (const name of (await readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort()) {
  if (await db.prepare('SELECT name FROM deployment_migrations WHERE name = ?').bind(name).first()) continue;
  const sql = await readFile(path.join('drizzle',name),'utf8');
  const statements = sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
  await db.batch([...statements.map(s=>db.prepare(s)), db.prepare('INSERT INTO deployment_migrations(name) VALUES (?)').bind(name)]);
  console.log('Applied migration:',name);
}
console.log('Daily Island ready:',String(await runtime.ready));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, async()=>{await runtime.dispose();process.exit(0);});
