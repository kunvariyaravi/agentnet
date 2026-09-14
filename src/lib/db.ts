import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'agentnet.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
    migrateSchema(_db);
    seedIfEmpty(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT DEFAULT 'user' CHECK(role IN ('user','admin','agent_owner')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      identity TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      owner_id TEXT REFERENCES users(id),
      avatar_url TEXT,
      status TEXT DEFAULT 'online' CHECK(status IN ('online','offline','busy','maintenance')),
      technology TEXT DEFAULT 'Private',
      pricing_type TEXT DEFAULT 'per_work' CHECK(pricing_type IN ('free','per_work','subscription')),
      price REAL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      avg_delivery_minutes INTEGER DEFAULT 5,
      is_simulated INTEGER DEFAULT 0,
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
      flow_config TEXT DEFAULT '[]',
      auto_execute INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_skills (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      input_types TEXT DEFAULT '[]',
      output_types TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS works (
      id TEXT PRIMARY KEY,
      work_number TEXT UNIQUE NOT NULL,
      requester_id TEXT NOT NULL REFERENCES users(id),
      agent_id TEXT NOT NULL REFERENCES agents(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'CREATED' CHECK(status IN ('CREATED','ACCEPTED','WORKING','INPUT_REQUIRED','QUALITY_CHECK','COMPLETED','FAILED','CANCELLED','REJECTED')),
      price REAL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending','authorized','released','refunded','failed')),
      parent_work_id TEXT REFERENCES works(id),
      created_at TEXT DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS work_inputs (
      id TEXT PRIMARY KEY,
      work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS work_outputs (
      id TEXT PRIMARY KEY,
      work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      artifact_type TEXT DEFAULT 'file',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS work_events (
      id TEXT PRIMARY KEY,
      work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      message TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      work_id TEXT NOT NULL REFERENCES works(id),
      payer_id TEXT NOT NULL REFERENCES users(id),
      payee_agent_id TEXT NOT NULL REFERENCES agents(id),
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','authorized','captured','released','refunded','failed')),
      provider TEXT DEFAULT 'simulated',
      provider_ref TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY,
      work_id TEXT UNIQUE NOT NULL REFERENCES works(id),
      rater_id TEXT NOT NULL REFERENCES users(id),
      agent_id TEXT NOT NULL REFERENCES agents(id),
      score INTEGER NOT NULL CHECK(score >= 1 AND score <= 5),
      quality INTEGER CHECK(quality >= 1 AND quality <= 5),
      reliability INTEGER CHECK(reliability >= 1 AND reliability <= 5),
      speed INTEGER CHECK(speed >= 1 AND speed <= 5),
      value INTEGER CHECK(value >= 1 AND value <= 5),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      work_id TEXT UNIQUE NOT NULL REFERENCES works(id),
      rater_id TEXT NOT NULL REFERENCES users(id),
      agent_id TEXT NOT NULL REFERENCES agents(id),
      title TEXT,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_reputation (
      agent_id TEXT PRIMARY KEY REFERENCES agents(id),
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
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_delegations (
      id TEXT PRIMARY KEY,
      parent_work_id TEXT NOT NULL REFERENCES works(id),
      child_work_id TEXT NOT NULL REFERENCES works(id),
      delegator_agent_id TEXT REFERENCES agents(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      read INTEGER DEFAULT 0,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// Add new columns to existing tables that were created before the new schema
function migrateSchema(db: Database.Database) {
  const agentCols = db.prepare('PRAGMA table_info(agents)').all() as { name: string }[];
  const colNames = new Set(agentCols.map(c => c.name));

  const newAgentCols: [string, string][] = [
    ['agent_type', 'TEXT DEFAULT \'custom\''],
    ['llm_provider', 'TEXT DEFAULT \'nvidia\''],
    ['llm_model', 'TEXT'],
    ['llm_api_key', 'TEXT'],
    ['llm_base_url', 'TEXT'],
    ['system_prompt', 'TEXT'],
    ['temperature', 'REAL DEFAULT 0.7'],
    ['max_tokens', 'INTEGER DEFAULT 4096'],
    ['flow_config', 'TEXT DEFAULT \'[]\''],
    ['auto_execute', 'INTEGER DEFAULT 1'],
  ];

  for (const [name, type] of newAgentCols) {
    if (!colNames.has(name)) {
      try {
        db.exec(`ALTER TABLE agents ADD COLUMN ${name} ${type}`);
      } catch {
        // Column already exists — safe to ignore
      }
    }
  }
}

function seedIfEmpty(db: Database.Database) {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get() as any;
  if (count.c > 0) return;

  const { v4: uuid } = require('uuid');

  // Create initial admin user with a random password
  const bcrypt = require('bcryptjs');
  const crypto = require('crypto');
  const adminPassword = crypto.randomBytes(16).toString('hex');
  const hash = bcrypt.hashSync(adminPassword, 12);

  db.prepare(`INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)`).run(
    uuid(), 'admin@agentnet.ai', 'Admin', hash, 'admin'
  );

  console.log('Database seeded with admin user');
  console.log(`Admin password: ${adminPassword}`);
  console.log('Save this password — it will not be shown again.');
}

export default getDb;
