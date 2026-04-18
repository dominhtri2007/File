const sqlite3 = require('./node_modules/sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database. Running migrations...');
    migrate();
  }
});

function migrate() {
  db.serialize(() => {
    // 1. Create settings table if not exists
    db.run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`, (err) => {
        if(err) console.error(err);
        else console.log("Settings table OK");
    });

    // 2. Add new columns to steam_accounts (ignore errors if columns already exist)
    const columns = ['image_url', 'price', 'discount', 'description'];
    
    columns.forEach(col => {
      db.run(`ALTER TABLE steam_accounts ADD COLUMN ${col} TEXT`, (err) => {
        if (err) {
          // It's fine if it errors because column exists
          console.log(`Column ${col} might already exist:`, err.message);
        } else {
          console.log(`Added column ${col} successfully.`);
        }
      });
    });

    // 3. Ensure default settings
    db.get("SELECT * FROM settings WHERE key = 'zalo'", [], (err, row) => {
      if (!row) {
        db.run("INSERT INTO settings (key, value) VALUES ('zalo', '')");
        db.run("INSERT INTO settings (key, value) VALUES ('facebook', '')");
        console.log("Default settings seeded.");
      }
    });

  });

  setTimeout(() => {
     db.close();
     console.log("Migration finished.");
  }, 2000);
}
