require('dotenv').config({ quiet: true });

const databaseProvider = (process.env.DB_PROVIDER || 'sqlite').toLowerCase();

if (databaseProvider === 'firebase' || databaseProvider === 'firestore') {
  module.exports = require('./firebaseDatabase');
  return;
}

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'customer',
      is_all_access INTEGER DEFAULT 0
    )`);

    const userColumns = ['email TEXT UNIQUE', 'email_verified INTEGER DEFAULT 0'];
    userColumns.forEach((columnDefinition) => {
      const columnName = columnDefinition.split(' ')[0];
      db.run(`ALTER TABLE users ADD COLUMN ${columnDefinition}`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error(`Error adding users.${columnName}:`, err.message);
        }
      });
    });

    db.run(`CREATE TABLE IF NOT EXISTS email_verifications (
      email TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS password_resets (
      email TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Settings table (Admin Contact Info)
    db.run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);

    // Steam Accounts table (Storefront)
    db.run(`CREATE TABLE IF NOT EXISTS steam_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_name TEXT NOT NULL,
      steam_username TEXT NOT NULL,
      steam_password_encrypted TEXT NOT NULL,
      email TEXT,
      steam_id TEXT,
      status TEXT DEFAULT 'Active',
      image_url TEXT,
      price TEXT,
      discount TEXT,
      description TEXT
    )`);

    // Keys table
    db.run(`CREATE TABLE IF NOT EXISTS keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_string TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL, -- 'all' or 'specific'
      steam_account_id INTEGER, -- nullable
      is_used INTEGER DEFAULT 0,
      FOREIGN KEY (steam_account_id) REFERENCES steam_accounts(id)
    )`);

    // User Account Access (Many-to-Many)
    db.run(`CREATE TABLE IF NOT EXISTS user_account_access (
      user_id INTEGER,
      steam_account_id INTEGER,
      PRIMARY KEY (user_id, steam_account_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (steam_account_id) REFERENCES steam_accounts(id)
    )`);

    // Seed default admin account
    db.get("SELECT id FROM users WHERE username = 'admin'", [], (err, row) => {
      if (!row) {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync('admin123', salt);
        db.run("INSERT INTO users (username, password_hash, role, is_all_access) VALUES (?, ?, 'admin', 1)", ['admin', hash], (insertErr) => {
          if (!insertErr) {
            console.log("Default admin account created. Username: admin | Password: admin123");
          }
        });
      }
    });

    // Seed default settings if empty
    db.get("SELECT * FROM settings WHERE key = 'zalo'", [], (err, row) => {
      if (!row) {
        db.run("INSERT INTO settings (key, value) VALUES ('zalo', '')");
        db.run("INSERT INTO settings (key, value) VALUES ('facebook', '')");
      }
    });
  });
}

// Wrapper for async usage
const dbGet = (query, params = []) => new Promise((resolve, reject) => {
  db.get(query, params, (err, row) => err ? reject(err) : resolve(row));
});

const dbAll = (query, params = []) => new Promise((resolve, reject) => {
  db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
});

const dbRun = (query, params = []) => new Promise((resolve, reject) => {
  db.run(query, params, function(err) { err ? reject(err) : resolve(this) });
});

module.exports = {
  db,
  dbGet,
  dbAll,
  dbRun
};
