const sqlite3 = require('./node_modules/sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database. Running V4 migrations...');
    migrate();
  }
});

function migrate() {
  db.serialize(() => {
    
    // Add game_type to steam_accounts
    db.run(`ALTER TABLE steam_accounts ADD COLUMN game_type TEXT DEFAULT 'steam'`, (err) => {
        if(err) console.log("steam_accounts.game_type might already exist");
        else console.log("Added column game_type to steam_accounts");
    });

    // Add download_link to steam_accounts
    db.run(`ALTER TABLE steam_accounts ADD COLUMN download_link TEXT`, (err) => {
        if(err) console.log("steam_accounts.download_link might already exist");
        else console.log("Added download_link to steam_accounts");
    });

    // Ensure settings table has guide_html
    db.get("SELECT * FROM settings WHERE key = 'guide_html'", [], (err, row) => {
       if (!row) {
         db.run("INSERT INTO settings (key, value) VALUES ('guide_html', '<h1>Hướng Dẫn Mua Code</h1><p>Nội dung đang được cập nhật...</p>')");
         console.log("Seeded default guide_html");
       }
    });

    // Create Services table
    db.run(`CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price TEXT,
      description TEXT,
      image_url TEXT
    )`, (err) => {
        if(err) console.error(err);
        else console.log("Services table OK");
    });

  });

  setTimeout(() => {
     db.close();
     console.log("Migration V4 finished.");
  }, 2000);
}
