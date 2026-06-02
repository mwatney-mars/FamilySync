import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, 'familyhub.db');

// Habilitar modo verbose para depuração se necessário
const sqlite = sqlite3.verbose();
const db = new sqlite.Database(dbPath);

// Helper para converter operações sqlite em Promises
export const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

// Inicializar banco de dados
export const initDb = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      join_code TEXT UNIQUE NOT NULL,
      e2ee_salt TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      display_name TEXT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      family_id TEXT,
      FOREIGN KEY (family_id) REFERENCES families(id)
    )
  `);

  try {
    await run(`ALTER TABLE users ADD COLUMN display_name TEXT`);
  } catch (e) {
    // Coluna já existe
  }
  try {
    await run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`);
  } catch (e) {
    // Coluna já existe
  }
  try {
    await run(`ALTER TABLE users ADD COLUMN family_title TEXT DEFAULT 'Membro'`);
  } catch (e) {
    // Coluna já existe
  }
  try {
    await run(`ALTER TABLE users ADD COLUMN birth_date TEXT`);
  } catch (e) {
    // Coluna já existe
  }
  try {
    await run(`ALTER TABLE users ADD COLUMN gender TEXT`);
  } catch (e) {
    // Coluna já existe
  }
  try {
    await run(`ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'dark'`);
  } catch (e) {
    // Coluna já existe
  }
  try {
    await run(`ALTER TABLE users ADD COLUMN accent_theme TEXT DEFAULT 'violet'`);
  } catch (e) {
    // Coluna já existe
  }
  try {
    await run(`ALTER TABLE families ADD COLUMN creator_id TEXT`);
  } catch (e) {
    // Coluna já existe
  }
  try {
    await run(`ALTER TABLE users ADD COLUMN avatar TEXT`);
  } catch (e) {
    // Coluna já existe
  }

  await run(`
    CREATE TABLE IF NOT EXISTS sync_items (
      id TEXT NOT NULL,
      family_id TEXT NOT NULL,
      collection TEXT NOT NULL,
      encrypted_data TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted INTEGER DEFAULT 0,
      PRIMARY KEY (id, family_id),
      FOREIGN KEY (family_id) REFERENCES families(id)
    )
  `);

  // Criar índices para otimizar busca de sincronização
  await run(`CREATE INDEX IF NOT EXISTS idx_sync_family_time ON sync_items (family_id, updated_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_sync_collection ON sync_items (collection)`);

  // Criar tabela para Assinaturas de Notificação Push
  await run(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      family_id TEXT NOT NULL,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (family_id) REFERENCES families(id)
    )
  `);

  // Criar tabela para Credenciais Biométricas (WebAuthn Passkeys)
  await run(`
    CREATE TABLE IF NOT EXISTS biometric_credentials (
      credential_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      transports TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  // Criar índice único para username para garantir integridade
  try {
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username)`);
  } catch (idxError) {
    console.log('Não foi possível criar índice único para username:', idxError.message);
  }

  // --- ROTINA DE SEEDING E MIGRAÇÃO DOS USUÁRIOS DE TESTE ---
  try {
    // Legacy username migration removed because username is now a first-class required column and overwriting custom usernames on startup is incorrect.

    // 2. Seeding inicial caso o banco não possua nenhum usuário cadastrado
    const updatedUsers = await query('SELECT count(*) as count FROM users');
    if (updatedUsers[0].count === 0) {
      console.log('[Seed] Banco de dados vazio. Semeando família padrão e administrador inicial...');
      const familyId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      const salt = crypto.randomBytes(16).toString('hex');
      const passHash = await bcrypt.hash('admin', 10);

      await run(
        'INSERT INTO families (id, name, join_code, e2ee_salt, creator_id) VALUES (?, ?, ?, ?, ?)',
        [familyId, 'My Family', 'FH1234', salt, userId]
      );

      await run(
        'INSERT INTO users (id, username, display_name, email, password_hash, family_id, role, family_title) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, 'admin', 'Administrador', 'admin@familyhub.local', passHash, familyId, 'admin', null]
      );

      console.log(`[Seed] Semeado com sucesso!`);
      console.log(` -> Família: "My Family" (Código de Convite: FS1234)`);
      console.log(` -> Administrador: username "admin" / senha "admin"`);
    }
  } catch (seedError) {
    console.error('[Seeding/Migração Error]:', seedError);
  }

  console.log('Database initialized successfully at:', dbPath);
};

export const resetDb = async () => {
  try {
    await run(`DROP TABLE IF EXISTS push_subscriptions`);
    await run(`DROP TABLE IF EXISTS biometric_credentials`);
    await run(`DROP TABLE IF EXISTS sync_items`);
    await run(`DROP TABLE IF EXISTS users`);
    await run(`DROP TABLE IF EXISTS families`);
    console.log('[Reset] Tabelas locais dropadas com sucesso. Inicializando banco de dados...');
    await initDb();
  } catch (err) {
    console.error('Erro ao reiniciar banco SQLite:', err);
    throw err;
  }
};


