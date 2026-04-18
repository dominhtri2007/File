require('dotenv').config({ quiet: true });

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const {
  firestore,
  COLLECTIONS,
  setCounterAtLeast,
} = require('./firebaseDatabase');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const sqlite = new sqlite3.Database(dbPath);

const TABLES = [
  { table: 'users', collection: COLLECTIONS.users, idField: 'id' },
  { table: 'settings', collection: COLLECTIONS.settings, idField: 'key' },
  { table: 'steam_accounts', collection: COLLECTIONS.steamAccounts, idField: 'id' },
  { table: 'keys', collection: COLLECTIONS.keys, idField: 'id' },
  {
    table: 'user_account_access',
    collection: COLLECTIONS.userAccountAccess,
    idField: (row) => `${row.user_id}_${row.steam_account_id}`,
  },
  { table: 'orders', collection: COLLECTIONS.orders, idField: 'id' },
  { table: 'services', collection: COLLECTIONS.services, idField: 'id' },
];

function all(query, params = []) {
  return new Promise((resolve, reject) => {
    sqlite.all(query, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function normalizeRow(row, table) {
  const normalized = { ...row };

  if (table === 'user_account_access') {
    normalized.id = `${row.user_id}_${row.steam_account_id}`;
  }

  if (table === 'orders' && !normalized.redeemed_at) {
    normalized.redeemed_at = new Date().toISOString();
  }

  return Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => value !== undefined)
  );
}

async function commitBatch(operations) {
  for (let i = 0; i < operations.length; i += 450) {
    const batch = firestore.batch();
    operations.slice(i, i + 450).forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
    await batch.commit();
  }
}

async function migrateTable({ table, collection, idField }) {
  const rows = await all(`SELECT * FROM ${table}`);
  const operations = [];
  let maxNumericId = 0;

  rows.forEach((row) => {
    const docId = typeof idField === 'function' ? idField(row) : row[idField];
    if (docId === null || docId === undefined || docId === '') return;

    const data = normalizeRow(row, table);
    operations.push({
      ref: firestore.collection(collection).doc(String(docId)),
      data,
    });

    if (typeof idField === 'string' && idField === 'id' && Number(row.id) > maxNumericId) {
      maxNumericId = Number(row.id);
    }
  });

  await commitBatch(operations);

  if (maxNumericId > 0) {
    await setCounterAtLeast(collection, maxNumericId);
  }

  console.log(`Migrated ${rows.length} rows from ${table} to ${collection}.`);
}

async function main() {
  if (!['firebase', 'firestore'].includes((process.env.DB_PROVIDER || '').toLowerCase())) {
    console.warn('DB_PROVIDER is not firebase. The script will still write to Firebase using the provided credentials.');
  }

  for (const table of TABLES) {
    await migrateTable(table);
  }

  sqlite.close();
  console.log('SQLite to Firebase migration finished.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    sqlite.close();
    console.error(err);
    process.exit(1);
  });
