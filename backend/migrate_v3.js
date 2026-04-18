const sqlite3 = require('./node_modules/sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database. Running V3 migrations...');
    migrate();
  }
});

function migrate() {
  db.serialize(() => {
    
    // Add duration to keys
    db.run(`ALTER TABLE keys ADD COLUMN duration TEXT DEFAULT 'permanent'`, (err) => {
        if(err) console.log("keys.duration might already exist");
        else console.log("Added column duration to keys");
    });

    // Add expires_at and order_code to user_account_access
    db.run(`ALTER TABLE user_account_access ADD COLUMN expires_at DATETIME`, (err) => {
        if(err) console.log("user_account_access.expires_at might expire");
    });
    db.run(`ALTER TABLE user_account_access ADD COLUMN order_code TEXT`, (err) => {
        if(err) console.log("user_account_access.order_code might exist");
        else console.log("Added expires_at and order_code to user_account_access");
    });

    // Add all_access_expires_at to users
    db.run(`ALTER TABLE users ADD COLUMN all_access_expires_at DATETIME`, (err) => {
        if(err) console.log("users.all_access_expires_at might exist");
        else console.log("Added all_access_expires_at to users");
    });

    // Create Orders history table
    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      key_string TEXT,
      duration TEXT,
      game_name TEXT,
      redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    )`, (err) => {
        if(err) console.error(err);
        else console.log("Orders table OK");
    });

  });

  setTimeout(() => {
     db.close();
     console.log("Migration V3 finished.");
  }, 2000);
}
