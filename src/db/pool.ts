import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// Single shared connection pool for the entire server process.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Neon
  max: 10,
});

pool.on('error', (err) => {
  console.error('[db] unexpected pool error:', err);
});

export default pool;
