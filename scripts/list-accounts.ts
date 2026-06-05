import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const { rows } = await pool.query(
    `SELECT id, email, first_name, last_name, created_at FROM users ORDER BY created_at`
  );
  console.log(`Total accounts: ${rows.length}`);
  console.log('');
  for (const r of rows) {
    const keep = r.email === 'mira.fitisova@icloud.com' ? ' <-- KEEP' : ' <-- DELETE';
    console.log(`${r.email} (${r.first_name ?? ''} ${r.last_name ?? ''}) | ${r.id}${keep}`);
  }
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
