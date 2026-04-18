const admin = require('firebase-admin');
const bcrypt = require('bcrypt');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

const COLLECTIONS = {
  users: 'users',
  settings: 'settings',
  steamAccounts: 'steam_accounts',
  keys: 'keys',
  userAccountAccess: 'user_account_access',
  emailVerifications: 'email_verifications',
  passwordResets: 'password_resets',
  orders: 'orders',
  services: 'services',
  counters: '_counters',
};

function normalizePrivateKey(key) {
  return key ? key.replace(/\\n/g, '\n') : key;
}

function initFirebase() {
  if (admin.apps.length) return admin.firestore();

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  let credential;
  if (serviceAccountPath) {
    const resolvedPath = path.resolve(__dirname, serviceAccountPath);
    credential = admin.credential.cert(require(resolvedPath));
  } else if (projectId && clientEmail && privateKey) {
    credential = admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    });
  } else {
    credential = admin.credential.applicationDefault();
  }

  admin.initializeApp({
    credential,
    projectId,
  });

  return admin.firestore();
}

const firestore = initFirebase();
const batchStorage = new AsyncLocalStorage();

function toInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isNaN(number) ? value : number;
}

function removeUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  );
}

function docToRow(doc) {
  if (!doc.exists) return null;
  return doc.data();
}

async function nextId(collectionName) {
  const counterRef = firestore.collection(COLLECTIONS.counters).doc(collectionName);
  const result = await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(counterRef);
    const current = snapshot.exists ? snapshot.data().value || 0 : 0;
    const next = current + 1;
    transaction.set(counterRef, { value: next }, { merge: true });
    return next;
  });
  return result;
}

async function setCounterAtLeast(collectionName, value) {
  const counterRef = firestore.collection(COLLECTIONS.counters).doc(collectionName);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(counterRef);
    const current = snapshot.exists ? snapshot.data().value || 0 : 0;
    if (value > current) {
      transaction.set(counterRef, { value }, { merge: true });
    }
  });
}

async function getByField(collectionName, field, value) {
  const snapshot = await firestore
    .collection(collectionName)
    .where(field, '==', value)
    .limit(1)
    .get();

  return snapshot.empty ? null : snapshot.docs[0].data();
}

async function getById(collectionName, id) {
  const doc = await firestore.collection(collectionName).doc(String(id)).get();
  return docToRow(doc);
}

async function getAll(collectionName) {
  const snapshot = await firestore.collection(collectionName).get();
  return snapshot.docs.map((doc) => doc.data());
}

async function getWhere(collectionName, field, value) {
  const snapshot = await firestore
    .collection(collectionName)
    .where(field, '==', value)
    .get();

  return snapshot.docs.map((doc) => doc.data());
}

async function orderByIdDesc(collectionName) {
  const rows = await getAll(collectionName);
  return rows.sort((a, b) => (b.id || 0) - (a.id || 0));
}

async function initDb() {
  const adminUser = await getByField(COLLECTIONS.users, 'username', 'admin');
  if (!adminUser) {
    const hash = bcrypt.hashSync('admin123', bcrypt.genSaltSync(10));
    await firestore.collection(COLLECTIONS.users).doc('1').set({
      id: 1,
      username: 'admin',
      password_hash: hash,
      role: 'admin',
      is_all_access: 1,
      all_access_expires_at: null,
    });
    await setCounterAtLeast(COLLECTIONS.users, 1);
    console.log('Default admin account created in Firebase. Username: admin | Password: admin123');
  }

  const zalo = await firestore.collection(COLLECTIONS.settings).doc('zalo').get();
  if (!zalo.exists) {
    await firestore.collection(COLLECTIONS.settings).doc('zalo').set({ key: 'zalo', value: '' });
    await firestore.collection(COLLECTIONS.settings).doc('facebook').set({ key: 'facebook', value: '' });
  }
}

function startsWithQuery(query, pattern) {
  return query.replace(/\s+/g, ' ').trim().toLowerCase().startsWith(pattern);
}

async function commitPendingBatch() {
  const store = batchStorage.getStore();
  if (!store?.ops) return { changes: 0 };

  const operations = store.ops;
  store.ops = null;
  for (let i = 0; i < operations.length; i += 450) {
    const batch = firestore.batch();
    operations.slice(i, i + 450).forEach((operation) => {
      if (operation.type === 'set') {
        batch.set(operation.ref, operation.data, operation.options);
      } else if (operation.type === 'delete') {
        batch.delete(operation.ref);
      }
    });
    await batch.commit();
  }

  return { changes: operations.length };
}

function queueOrSet(ref, data, options = {}) {
  const store = batchStorage.getStore();
  if (store?.ops) {
    store.ops.push({ type: 'set', ref, data, options });
    return Promise.resolve();
  }

  return ref.set(data, options);
}

function queueOrDelete(ref) {
  const store = batchStorage.getStore();
  if (store?.ops) {
    store.ops.push({ type: 'delete', ref });
    return Promise.resolve();
  }

  return ref.delete();
}

async function dbGet(query, params = []) {
  const normalized = query.replace(/\s+/g, ' ').trim().toLowerCase();

  if (normalized === 'select * from users where username = ?') {
    return getByField(COLLECTIONS.users, 'username', params[0]);
  }

  if (normalized === 'select * from users where email = ?') {
    return getByField(COLLECTIONS.users, 'email', params[0]);
  }

  if (normalized === 'select * from users where id = ?') {
    return getById(COLLECTIONS.users, params[0]);
  }

  if (normalized === "select id from users where username = 'admin'") {
    const user = await getByField(COLLECTIONS.users, 'username', 'admin');
    return user ? { id: user.id } : null;
  }

  if (normalized === "select * from settings where key = 'zalo'") {
    return getById(COLLECTIONS.settings, 'zalo');
  }

  if (normalized === "select * from settings where key = 'guide_html'") {
    return getById(COLLECTIONS.settings, 'guide_html');
  }

  if (normalized === 'select * from keys where key_string = ? and is_used = 0') {
    const key = await getByField(COLLECTIONS.keys, 'key_string', params[0]);
    return key && Number(key.is_used) === 0 ? key : null;
  }

  if (normalized === 'select * from keys where id = ?') {
    return getById(COLLECTIONS.keys, params[0]);
  }

  if (normalized === 'select game_name from steam_accounts where id = ?') {
    const game = await getById(COLLECTIONS.steamAccounts, params[0]);
    return game ? { game_name: game.game_name } : null;
  }

  if (normalized === 'select * from user_account_access where user_id = ? and steam_account_id = ?') {
    const docId = `${params[0]}_${params[1]}`;
    return getById(COLLECTIONS.userAccountAccess, docId);
  }

  if (normalized === 'select * from email_verifications where email = ?') {
    return getById(COLLECTIONS.emailVerifications, params[0]);
  }

  if (normalized === 'select * from password_resets where email = ?') {
    return getById(COLLECTIONS.passwordResets, params[0]);
  }

  throw new Error(`Unsupported Firebase dbGet query: ${query}`);
}

async function dbAll(query, params = []) {
  const normalized = query.replace(/\s+/g, ' ').trim().toLowerCase();

  if (normalized === 'select * from settings') {
    return getAll(COLLECTIONS.settings);
  }

  if (normalized === 'select id, game_name, steam_username, steam_password_encrypted, status, email, notes, image_url, price, discount, description, game_type, download_link from steam_accounts') {
    const games = await getAll(COLLECTIONS.steamAccounts);
    return games.map((game) => ({
      id: game.id,
      game_name: game.game_name,
      steam_username: game.steam_username,
      steam_password_encrypted: game.steam_password_encrypted,
      status: game.status,
      email: game.email,
      notes: game.notes,
      image_url: game.image_url,
      price: game.price,
      discount: game.discount,
      description: game.description,
      game_type: game.game_type,
      download_link: game.download_link,
    }));
  }

  if (normalized === 'select * from user_account_access where user_id = ?') {
    return getWhere(COLLECTIONS.userAccountAccess, 'user_id', toInteger(params[0]));
  }

  if (normalized === 'select * from steam_accounts') {
    return getAll(COLLECTIONS.steamAccounts);
  }

  if (normalized === 'select keys.*, steam_accounts.game_name from keys left join steam_accounts on keys.steam_account_id = steam_accounts.id order by keys.id desc') {
    const keys = await orderByIdDesc(COLLECTIONS.keys);
    const games = await getAll(COLLECTIONS.steamAccounts);
    const gameById = new Map(games.map((game) => [Number(game.id), game]));
    return keys.map((key) => ({
      ...key,
      game_name: key.steam_account_id ? gameById.get(Number(key.steam_account_id))?.game_name || null : null,
    }));
  }

  if (normalized === 'select orders.*, users.username from orders left join users on orders.user_id = users.id order by orders.id desc') {
    const orders = await orderByIdDesc(COLLECTIONS.orders);
    const users = await getAll(COLLECTIONS.users);
    const userById = new Map(users.map((user) => [Number(user.id), user]));
    return orders.map((order) => ({
      ...order,
      username: order.user_id ? userById.get(Number(order.user_id))?.username || null : null,
    }));
  }

  if (normalized === 'select * from services order by id desc') {
    return orderByIdDesc(COLLECTIONS.services);
  }

  throw new Error(`Unsupported Firebase dbAll query: ${query}`);
}

async function insertUser(params) {
  const id = await nextId(COLLECTIONS.users);
  const hasEmail = params.length >= 5;
  await queueOrSet(firestore.collection(COLLECTIONS.users).doc(String(id)), {
    id,
    username: params[0],
    email: hasEmail ? params[1] : null,
    password_hash: hasEmail ? params[2] : params[1],
    role: hasEmail ? params[3] : params[2],
    is_all_access: hasEmail ? params[4] : params[3],
    email_verified: hasEmail ? 1 : 0,
    all_access_expires_at: null,
  });
  return { lastID: id, changes: 1 };
}

async function insertSteamAccount(params) {
  const id = await nextId(COLLECTIONS.steamAccounts);
  await queueOrSet(firestore.collection(COLLECTIONS.steamAccounts).doc(String(id)), removeUndefined({
    id,
    game_name: params[0],
    steam_username: params[1] || '',
    steam_password_encrypted: params[2],
    email: params[3] || '',
    status: params[4] || 'Active',
    notes: params[5] || '',
    image_url: params[6] || '',
    price: params[7] || '',
    discount: params[8] || '',
    description: params[9] || '',
    game_type: params[10] || 'steam',
    download_link: params[11] || '',
  }));
  return { lastID: id, changes: 1 };
}

async function insertKey(params) {
  const id = await nextId(COLLECTIONS.keys);
  await queueOrSet(firestore.collection(COLLECTIONS.keys).doc(String(id)), {
    id,
    key_string: params[0],
    type: params[1],
    steam_account_id: params[2] === null || params[2] === undefined ? null : toInteger(params[2]),
    is_used: 0,
    duration: params[3] || 'permanent',
  });
  return { lastID: id, changes: 1 };
}

async function insertAccess(params) {
  const userId = toInteger(params[0]);
  const steamAccountId = toInteger(params[1]);
  const docId = `${userId}_${steamAccountId}`;
  await queueOrSet(firestore.collection(COLLECTIONS.userAccountAccess).doc(docId), {
    id: docId,
    user_id: userId,
    steam_account_id: steamAccountId,
    expires_at: params[2] || null,
    order_code: params[3] || null,
  });
  return { lastID: docId, changes: 1 };
}

async function insertOrder(params) {
  const id = await nextId(COLLECTIONS.orders);
  await queueOrSet(firestore.collection(COLLECTIONS.orders).doc(String(id)), {
    id,
    order_code: params[0],
    user_id: toInteger(params[1]),
    key_string: params[2],
    duration: params[3],
    game_name: params[4],
    redeemed_at: new Date().toISOString(),
    expires_at: params[5] || null,
  });
  return { lastID: id, changes: 1 };
}

async function insertService(params) {
  const id = await nextId(COLLECTIONS.services);
  await queueOrSet(firestore.collection(COLLECTIONS.services).doc(String(id)), {
    id,
    name: params[0],
    price: params[1] || '',
    description: params[2] || '',
    image_url: params[3] || '',
  });
  return { lastID: id, changes: 1 };
}

async function dbRun(query, params = []) {
  const normalized = query.replace(/\s+/g, ' ').trim().toLowerCase();

  if (normalized === 'begin transaction') {
    batchStorage.enterWith({ ops: [] });
    return { changes: 0 };
  }

  if (normalized === 'commit') {
    return commitPendingBatch();
  }

  if (normalized === 'rollback') {
    const store = batchStorage.getStore();
    if (store) store.ops = null;
    return { changes: 0 };
  }

  if (normalized === "update settings set value = ? where key = 'zalo'") {
    await queueOrSet(firestore.collection(COLLECTIONS.settings).doc('zalo'), { key: 'zalo', value: params[0] }, { merge: true });
    return { changes: 1 };
  }

  if (normalized === "update settings set value = ? where key = 'facebook'") {
    await queueOrSet(firestore.collection(COLLECTIONS.settings).doc('facebook'), { key: 'facebook', value: params[0] }, { merge: true });
    return { changes: 1 };
  }

  if (normalized === "update settings set value = ? where key = 'guide_html'") {
    await queueOrSet(firestore.collection(COLLECTIONS.settings).doc('guide_html'), { key: 'guide_html', value: params[0] }, { merge: true });
    return { changes: 1 };
  }

  if (normalized === "insert into settings (key, value) values ('guide_html', ?)") {
    await queueOrSet(firestore.collection(COLLECTIONS.settings).doc('guide_html'), { key: 'guide_html', value: params[0] });
    return { changes: 1 };
  }

  if (startsWithQuery(query, 'insert into users')) {
    return insertUser(params);
  }

  if (startsWithQuery(query, 'insert or replace into email_verifications')) {
    await queueOrSet(firestore.collection(COLLECTIONS.emailVerifications).doc(String(params[0]).toLowerCase()), {
      email: String(params[0]).toLowerCase(),
      code_hash: params[1],
      expires_at: params[2],
      created_at: new Date().toISOString(),
    });
    return { changes: 1 };
  }

  if (startsWithQuery(query, 'insert or replace into password_resets')) {
    await queueOrSet(firestore.collection(COLLECTIONS.passwordResets).doc(String(params[0]).toLowerCase()), {
      email: String(params[0]).toLowerCase(),
      code_hash: params[1],
      expires_at: params[2],
      created_at: new Date().toISOString(),
    });
    return { changes: 1 };
  }

  if (normalized === 'delete from email_verifications where email = ?') {
    await queueOrDelete(firestore.collection(COLLECTIONS.emailVerifications).doc(String(params[0]).toLowerCase()));
    return { changes: 1 };
  }

  if (normalized === 'delete from password_resets where email = ?') {
    await queueOrDelete(firestore.collection(COLLECTIONS.passwordResets).doc(String(params[0]).toLowerCase()));
    return { changes: 1 };
  }

  if (normalized === 'update users set password_hash = ? where email = ?') {
    const existingUser = await getByField(COLLECTIONS.users, 'email', String(params[1]).toLowerCase());
    if (!existingUser) return { changes: 0 };
    await queueOrSet(
      firestore.collection(COLLECTIONS.users).doc(String(existingUser.id)),
      { password_hash: params[0] },
      { merge: true }
    );
    return { changes: 1 };
  }

  if (normalized === 'update users set is_all_access = 0 where id = ?') {
    await queueOrSet(firestore.collection(COLLECTIONS.users).doc(String(params[0])), { is_all_access: 0 }, { merge: true });
    return { changes: 1 };
  }

  if (normalized === 'update keys set is_used = 1 where id = ?') {
    await queueOrSet(firestore.collection(COLLECTIONS.keys).doc(String(params[0])), { is_used: 1 }, { merge: true });
    return { changes: 1 };
  }

  if (normalized === 'update users set is_all_access = 1, all_access_expires_at = ? where id = ?') {
    await queueOrSet(firestore.collection(COLLECTIONS.users).doc(String(params[1])), {
      is_all_access: 1,
      all_access_expires_at: params[0] || null,
    }, { merge: true });
    return { changes: 1 };
  }

  if (startsWithQuery(query, 'insert into user_account_access')) {
    return insertAccess(params);
  }

  if (normalized === 'update user_account_access set expires_at = ?, order_code = ? where user_id = ? and steam_account_id = ?') {
    const docId = `${params[2]}_${params[3]}`;
    await queueOrSet(firestore.collection(COLLECTIONS.userAccountAccess).doc(docId), {
      user_id: toInteger(params[2]),
      steam_account_id: toInteger(params[3]),
      expires_at: params[0] || null,
      order_code: params[1] || null,
    }, { merge: true });
    return { changes: 1 };
  }

  if (startsWithQuery(query, 'insert into orders')) {
    return insertOrder(params);
  }

  if (startsWithQuery(query, 'insert into steam_accounts')) {
    return insertSteamAccount(params);
  }

  if (startsWithQuery(query, 'update steam_accounts set')) {
    const update = {
      game_name: params[0],
      steam_username: params[1] || '',
      email: params[2] || '',
      status: params[3] || 'Active',
      notes: params[4] || '',
      image_url: params[5] || '',
      price: params[6] || '',
      discount: params[7] || '',
      description: params[8] || '',
      game_type: params[9] || 'steam',
      download_link: params[10] || '',
    };

    if (normalized.includes('steam_password_encrypted = ?')) {
      update.steam_password_encrypted = params[11];
      await queueOrSet(firestore.collection(COLLECTIONS.steamAccounts).doc(String(params[12])), update, { merge: true });
    } else {
      await queueOrSet(firestore.collection(COLLECTIONS.steamAccounts).doc(String(params[11])), update, { merge: true });
    }
    return { changes: 1 };
  }

  if (normalized === 'delete from user_account_access where steam_account_id = ?') {
    const rows = await getWhere(COLLECTIONS.userAccountAccess, 'steam_account_id', toInteger(params[0]));
    await Promise.all(rows.map((row) => queueOrDelete(firestore.collection(COLLECTIONS.userAccountAccess).doc(row.id || `${row.user_id}_${row.steam_account_id}`))));
    return { changes: rows.length };
  }

  if (normalized === 'delete from keys where steam_account_id = ?') {
    const rows = await getWhere(COLLECTIONS.keys, 'steam_account_id', toInteger(params[0]));
    await Promise.all(rows.map((row) => queueOrDelete(firestore.collection(COLLECTIONS.keys).doc(String(row.id)))));
    return { changes: rows.length };
  }

  if (normalized === 'delete from keys where id = ?') {
    await queueOrDelete(firestore.collection(COLLECTIONS.keys).doc(String(params[0])));
    return { changes: 1 };
  }

  if (normalized === 'delete from steam_accounts where id = ?') {
    await queueOrDelete(firestore.collection(COLLECTIONS.steamAccounts).doc(String(params[0])));
    return { changes: 1 };
  }

  if (startsWithQuery(query, 'insert into keys')) {
    return insertKey(params);
  }

  if (startsWithQuery(query, 'insert into services')) {
    return insertService(params);
  }

  if (normalized === 'delete from services where id = ?') {
    await queueOrDelete(firestore.collection(COLLECTIONS.services).doc(String(params[0])));
    return { changes: 1 };
  }

  throw new Error(`Unsupported Firebase dbRun query: ${query}`);
}

initDb()
  .then(() => console.log('Connected to Firebase Firestore.'))
  .catch((err) => console.error('Error initializing Firebase Firestore', err.message));

module.exports = {
  db: firestore,
  dbGet,
  dbAll,
  dbRun,
  firestore,
  COLLECTIONS,
  setCounterAtLeast,
};
