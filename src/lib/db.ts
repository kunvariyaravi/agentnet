import { Pool, QueryResult, QueryResultRow } from 'pg';

const connectionString = process.env.POSTGRES_URL;
// Neon / hosted Postgres requires TLS. The old code disabled SSL in dev,
// which caused `ECONNRESET ... before secure TLS connection was established`
// and queries hanging for 20–40s against the Neon pooler.
const isRemoteDb =
  !!connectionString && !/(localhost|127\.0\.0\.1)/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function queryOne<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T | null> {
  const result = await pool.query<T>(text, params);
  return result.rows[0] ?? null;
}

export async function queryAll<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function run(text: string, params?: any[]): Promise<QueryResult> {
  return pool.query(text, params);
}

let schemaInitialized = false;

export async function ensureSchema(): Promise<void> {
  if (schemaInitialized) return;

  // Fast check: if users table exists, schema is already initialized
  const check = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') as exists`
  );
  if (check.rows[0].exists) {
    schemaInitialized = true;
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT DEFAULT 'user' CHECK(role IN ('user','admin','agent_owner')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS agents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      identity TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      owner_id UUID REFERENCES users(id),
      avatar_url TEXT,
      status TEXT DEFAULT 'online' CHECK(status IN ('online','offline','busy','maintenance')),
      technology TEXT DEFAULT 'Private',
      pricing_type TEXT DEFAULT 'per_work' CHECK(pricing_type IN ('free','per_work','subscription')),
      price REAL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      avg_delivery_minutes INTEGER DEFAULT 5,
      is_simulated BOOLEAN DEFAULT FALSE,
      endpoint_url TEXT,
      api_key TEXT,
      agent_type TEXT DEFAULT 'custom',
      llm_provider TEXT DEFAULT 'nvidia',
      llm_model TEXT,
      llm_api_key TEXT,
      llm_base_url TEXT,
      system_prompt TEXT,
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 4096,
      flow_config JSONB DEFAULT '[]'::jsonb,
      auto_execute BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS agent_skills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      input_types JSONB DEFAULT '[]'::jsonb,
      output_types JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS works (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      work_number TEXT UNIQUE NOT NULL,
      requester_id UUID NOT NULL REFERENCES users(id),
      agent_id UUID NOT NULL REFERENCES agents(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'CREATED' CHECK(status IN ('CREATED','ACCEPTED','WORKING','INPUT_REQUIRED','QUALITY_CHECK','COMPLETED','FAILED','CANCELLED','REJECTED')),
      price REAL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending','authorized','released','refunded','failed')),
      parent_work_id UUID REFERENCES works(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS work_inputs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS work_outputs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      artifact_type TEXT DEFAULT 'file',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS work_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      message TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      work_id UUID NOT NULL REFERENCES works(id),
      payer_id UUID NOT NULL REFERENCES users(id),
      payee_agent_id UUID NOT NULL REFERENCES agents(id),
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','authorized','captured','released','refunded','failed')),
      provider TEXT DEFAULT 'simulated',
      provider_ref TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      work_id UUID UNIQUE NOT NULL REFERENCES works(id),
      rater_id UUID NOT NULL REFERENCES users(id),
      agent_id UUID NOT NULL REFERENCES agents(id),
      score INTEGER NOT NULL CHECK(score >= 1 AND score <= 5),
      quality INTEGER CHECK(quality >= 1 AND quality <= 5),
      reliability INTEGER CHECK(reliability >= 1 AND reliability <= 5),
      speed INTEGER CHECK(speed >= 1 AND speed <= 5),
      value INTEGER CHECK(value >= 1 AND value <= 5),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      work_id UUID UNIQUE NOT NULL REFERENCES works(id),
      rater_id UUID NOT NULL REFERENCES users(id),
      agent_id UUID NOT NULL REFERENCES agents(id),
      title TEXT,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS agent_reputation (
      agent_id UUID PRIMARY KEY REFERENCES agents(id),
      total_works INTEGER DEFAULT 0,
      completed_works INTEGER DEFAULT 0,
      failed_works INTEGER DEFAULT 0,
      total_rated INTEGER DEFAULT 0,
      avg_rating REAL DEFAULT 0,
      avg_quality REAL DEFAULT 0,
      avg_reliability REAL DEFAULT 0,
      avg_speed REAL DEFAULT 0,
      avg_value REAL DEFAULT 0,
      success_rate REAL DEFAULT 0,
      repeat_hire_rate REAL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      title TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS agent_delegations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      parent_work_id UUID NOT NULL REFERENCES works(id),
      child_work_id UUID NOT NULL REFERENCES works(id),
      delegator_agent_id UUID REFERENCES agents(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      read BOOLEAN DEFAULT FALSE,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await seedIfEmpty();
  schemaInitialized = true;
}

async function seedIfEmpty(): Promise<void> {
  const result = await pool.query<{ c: number }>('SELECT COUNT(*)::int as c FROM users');
  if (result.rows[0].c > 0) return;

  const bcrypt = require('bcryptjs');
  const crypto = require('crypto');
  const adminPassword = crypto.randomBytes(16).toString('hex');
  const hash = bcrypt.hashSync(adminPassword, 12);

  await pool.query(
    'INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)',
    ['admin@agentnet.ai', 'Admin', hash, 'admin']
  );

  console.log('Database seeded with admin user');
  console.log(`Admin password: ${adminPassword}`);
  console.log('Save this password — it will not be shown again.');
}

export default pool;
