const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { dbGet, dbAll, dbRun } = require('./database');
const { encrypt, decrypt } = require('./utils/encrypt');
const { sendVerificationEmail, sendPasswordResetEmail } = require('./utils/email');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_steam_manager';
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors(corsOrigins.length ? { origin: corsOrigins } : undefined));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// --- MIDDLEWARES ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Truy cập bị từ chối' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token không hợp lệ' });
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Cần quyền Admin' });
  next();
};

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashVerificationCode(email, code) {
  return crypto
    .createHash('sha256')
    .update(`${normalizeEmail(email)}:${code}:${JWT_SECRET}`)
    .digest('hex');
}

// --- SETTINGS ROUTES ---
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await dbAll('SELECT * FROM settings');
    const result = {};
    settings.forEach(s => result[s.key] = s.value);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { zalo, facebook, guide_html } = req.body;
    if (zalo !== undefined) await dbRun("UPDATE settings SET value = ? WHERE key = 'zalo'", [zalo]);
    if (facebook !== undefined) await dbRun("UPDATE settings SET value = ? WHERE key = 'facebook'", [facebook]);
    if (guide_html !== undefined) {
      const exists = await dbGet("SELECT * FROM settings WHERE key = 'guide_html'");
      if(exists) await dbRun("UPDATE settings SET value = ? WHERE key = 'guide_html'", [guide_html]);
      else await dbRun("INSERT INTO settings (key, value) VALUES ('guide_html', ?)", [guide_html]);
    }
    res.json({ message: 'Cập nhật thông tin thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- AUTH ROUTES ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) return res.status(400).json({ error: 'Tài khoản không tồn tại' });
    
    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass) return res.status(400).json({ error: 'Sai mật khẩu' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, role: user.role, username: user.username, is_all_access: user.is_all_access });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/send-verification', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Email không hợp lệ.' });
    }

    const existingUser = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Email này đã được đăng ký.' });
    }

    const code = createVerificationCode();
    const ttlMinutes = Number(process.env.EMAIL_CODE_TTL_MINUTES || 10);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    await dbRun(
      'INSERT OR REPLACE INTO email_verifications (email, code_hash, expires_at) VALUES (?, ?, ?)',
      [email, hashVerificationCode(email, code), expiresAt]
    );

    let mailResult;
    try {
      mailResult = await sendVerificationEmail(email, code);
    } catch (emailErr) {
      await dbRun('DELETE FROM email_verifications WHERE email = ?', [email]);
      const status = emailErr.code === 'SMTP_NOT_CONFIGURED' ? 503 : 500;
      return res.status(status).json({ error: emailErr.message || 'Không gửi được mã xác thực email.' });
    }

    res.json({
      message: mailResult.sent
        ? 'Đã gửi mã xác thực về email của bạn.'
        : 'Đang bật chế độ test local. Mã xác thực được hiển thị trên màn hình.',
      dev_code: mailResult.devCode,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, verification_code } = req.body;
    const email = normalizeEmail(req.body.email);
    if (!username || !password || !email || !verification_code) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ tên đăng nhập, email, mật khẩu và mã xác thực.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email không hợp lệ.' });
    }

    const existingUser = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUser) return res.status(400).json({ error: 'Tên người dùng đã tồn tại.' });

    const existingEmail = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (existingEmail) return res.status(400).json({ error: 'Email này đã được đăng ký.' });

    const verification = await dbGet('SELECT * FROM email_verifications WHERE email = ?', [email]);
    if (!verification) {
      return res.status(400).json({ error: 'Vui lòng gửi mã xác thực email trước.' });
    }

    if (verification.expires_at && verification.expires_at < new Date().toISOString()) {
      return res.status(400).json({ error: 'Mã xác thực đã hết hạn. Vui lòng gửi lại mã mới.' });
    }

    const submittedCodeHash = hashVerificationCode(email, String(verification_code).trim());
    if (submittedCodeHash !== verification.code_hash) {
      return res.status(400).json({ error: 'Mã xác thực email không đúng.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    await dbRun('INSERT INTO users (username, email, password_hash, role, is_all_access) VALUES (?, ?, ?, ?, ?)', [username, email, hash, 'customer', 0]);
    await dbRun('DELETE FROM email_verifications WHERE email = ?', [email]);
    res.json({ message: 'Đăng ký thành công. Vui lòng đăng nhập.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Email không hợp lệ.' });
    }

    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ error: 'Email này chưa được đăng ký.' });
    }

    const code = createVerificationCode();
    const ttlMinutes = Number(process.env.EMAIL_CODE_TTL_MINUTES || 10);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    await dbRun(
      'INSERT OR REPLACE INTO password_resets (email, code_hash, expires_at) VALUES (?, ?, ?)',
      [email, hashVerificationCode(email, code), expiresAt]
    );

    let mailResult;
    try {
      mailResult = await sendPasswordResetEmail(email, code);
    } catch (emailErr) {
      await dbRun('DELETE FROM password_resets WHERE email = ?', [email]);
      const status = emailErr.code === 'SMTP_NOT_CONFIGURED' ? 503 : 500;
      return res.status(status).json({ error: emailErr.message || 'Không gửi được mã đặt lại mật khẩu.' });
    }

    res.json({
      message: mailResult.sent
        ? 'Đã gửi mã đặt lại mật khẩu về email của bạn.'
        : 'Đang bật chế độ test local. Mã đặt lại mật khẩu được hiển thị trên màn hình.',
      dev_code: mailResult.devCode,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const resetCode = String(req.body.reset_code || '').trim();
    const newPassword = String(req.body.new_password || '');

    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ email, mã xác thực và mật khẩu mới.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email không hợp lệ.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ error: 'Email này chưa được đăng ký.' });
    }

    const resetData = await dbGet('SELECT * FROM password_resets WHERE email = ?', [email]);
    if (!resetData) {
      return res.status(400).json({ error: 'Vui lòng gửi mã đặt lại mật khẩu trước.' });
    }

    if (resetData.expires_at && resetData.expires_at < new Date().toISOString()) {
      return res.status(400).json({ error: 'Mã đặt lại mật khẩu đã hết hạn. Vui lòng gửi lại mã mới.' });
    }

    const submittedCodeHash = hashVerificationCode(email, resetCode);
    if (submittedCodeHash !== resetData.code_hash) {
      return res.status(400).json({ error: 'Mã đặt lại mật khẩu không đúng.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    await dbRun('UPDATE users SET password_hash = ? WHERE email = ?', [hash, email]);
    await dbRun('DELETE FROM password_resets WHERE email = ?', [email]);

    res.json({ message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register-legacy-disabled', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Điền đầy đủ thông tin' });

    // Validate if user exists
    const existingUser = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUser) return res.status(400).json({ error: 'Tên người dùng đã tồn tại' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    await dbRun('INSERT INTO users (username, password_hash, role, is_all_access) VALUES (?, ?, ?, ?)', [username, hash, 'customer', 0]);
    res.json({ message: 'Đăng ký thành công. Vui lòng đăng nhập.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- USER ROUTES ---
app.get('/api/games', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const allGames = await dbAll('SELECT id, game_name, steam_username, steam_password_encrypted, status, email, notes, image_url, price, discount, description, game_type, download_link FROM steam_accounts');
    
    // Check access
    let validAccesses = [];
    let isVipValid = false;
    
    const nowISO = new Date().toISOString();

    if (user.is_all_access) {
      if (!user.all_access_expires_at || user.all_access_expires_at > nowISO) {
        isVipValid = true;
      } else {
        // Expired VIP
        await dbRun('UPDATE users SET is_all_access = 0 WHERE id = ?', [req.user.id]);
      }
    }

    if (!isVipValid) {
      const access = await dbAll('SELECT * FROM user_account_access WHERE user_id = ?', [req.user.id]);
      for (let a of access) {
        if (!a.expires_at || a.expires_at > nowISO) {
          validAccesses.push(a);
        }
      }
    }
    
    const validGameIds = validAccesses.map(a => a.steam_account_id);
    
    const result = allGames.map(game => {
      const isOwned = isVipValid || validGameIds.includes(game.id);
      
      let expires_at = null;
      if (isVipValid) expires_at = user.all_access_expires_at;
      else if (isOwned) {
          const acc = validAccesses.find(a => a.steam_account_id === game.id);
          expires_at = acc ? acc.expires_at : null;
      }

      if (isOwned) {
        const password = game.game_type === 'steam' ? decrypt(game.steam_password_encrypted) : null;
        return { 
            ...game, 
            steam_password: password, 
            is_owned: true, 
            expires_at: expires_at, 
            steam_password_encrypted: undefined 
        };
      } else {
        return { 
          id: game.id, 
          game_name: game.game_name, 
          status: game.status, 
          image_url: game.image_url,
          price: game.price,
          discount: game.discount,
          description: game.description,
          game_type: game.game_type,
          is_owned: false 
        };
      }
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function calculateExpiry(duration) {
  if (!duration || duration === 'permanent') return null;
  const now = new Date();
  switch(duration) {
    case '1_day': now.setDate(now.getDate() + 1); break;
    case '7_days': now.setDate(now.getDate() + 7); break;
    case '1_month': now.setMonth(now.getMonth() + 1); break;
    case '3_months': now.setMonth(now.getMonth() + 3); break;
    case '1_year': now.setFullYear(now.getFullYear() + 1); break;
    default: return null;
  }
  return now.toISOString();
}

app.post('/api/keys/redeem', authenticateToken, async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Vui lòng nhập Key' });

    const keyData = await dbGet('SELECT * FROM keys WHERE key_string = ? AND is_used = 0', [key]);
    if (!keyData) return res.status(400).json({ error: 'Key không hợp lệ hoặc đã được sử dụng' });

    const expires_at = calculateExpiry(keyData.duration);
    const order_code = 'ORD-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    let gameNameOrAll = 'VIP (Tất cả Game)';
    if (keyData.type === 'specific' && keyData.steam_account_id) {
        const game = await dbGet('SELECT game_name FROM steam_accounts WHERE id = ?', [keyData.steam_account_id]);
        if (game) gameNameOrAll = game.game_name;
    }

    await dbRun('BEGIN TRANSACTION');
    try {
      await dbRun('UPDATE keys SET is_used = 1 WHERE id = ?', [keyData.id]);
      
      if (keyData.type === 'all') {
        await dbRun('UPDATE users SET is_all_access = 1, all_access_expires_at = ? WHERE id = ?', [expires_at, req.user.id]);
      } else if (keyData.type === 'specific' && keyData.steam_account_id) {
        const exists = await dbGet('SELECT * FROM user_account_access WHERE user_id = ? AND steam_account_id = ?', [req.user.id, keyData.steam_account_id]);
        if (!exists) {
          await dbRun('INSERT INTO user_account_access (user_id, steam_account_id, expires_at, order_code) VALUES (?, ?, ?, ?)', [req.user.id, keyData.steam_account_id, expires_at, order_code]);
        } else {
          // extend or update
          await dbRun('UPDATE user_account_access SET expires_at = ?, order_code = ? WHERE user_id = ? AND steam_account_id = ?', [expires_at, order_code, req.user.id, keyData.steam_account_id]);
        }
      }
      
      await dbRun('INSERT INTO orders (order_code, user_id, key_string, duration, game_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)', 
        [order_code, req.user.id, keyData.key_string, keyData.duration || 'permanent', gameNameOrAll, expires_at]);

      await dbRun('COMMIT');
      res.json({ message: 'Đổi Key thành công!', order_code });
    } catch (e) {
      await dbRun('ROLLBACK');
      console.log(e);
      res.status(500).json({ error: 'Lỗi máy chủ khi đổi key' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- ADMIN ROUTES ---
app.get('/api/admin/games', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const games = await dbAll('SELECT * FROM steam_accounts');
    res.json(games.map(game => ({
      ...game,
      steam_password: decrypt(game.steam_password_encrypted)
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/games', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { game_name, steam_username, steam_password, email, status, notes, image_url, price, discount, description, game_type, download_link } = req.body;
    const encryptedPass = steam_password ? encrypt(steam_password) : encrypt('none');
    const type = game_type || 'steam';
    
    const result = await dbRun(
      'INSERT INTO steam_accounts (game_name, steam_username, steam_password_encrypted, email, status, notes, image_url, price, discount, description, game_type, download_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [game_name, steam_username || '', encryptedPass, email || '', status, notes || '', image_url || '', price || '', discount || '', description || '', type, download_link || '']
    );
    res.json({ id: result.lastID, message: 'Thêm tài khoản thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/games/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { game_name, steam_username, steam_password, email, status, notes, image_url, price, discount, description, game_type, download_link } = req.body;
    let updateQuery = 'UPDATE steam_accounts SET game_name = ?, steam_username = ?, email = ?, status = ?, notes = ?, image_url = ?, price = ?, discount = ?, description = ?, game_type = ?, download_link = ?';
    let params = [game_name, steam_username || '', email || '', status, notes || '', image_url || '', price || '', discount || '', description || '', game_type || 'steam', download_link || ''];
    
    if (steam_password && steam_password.trim() !== '') {
        updateQuery += ', steam_password_encrypted = ?';
        params.push(encrypt(steam_password));
    }
    updateQuery += ' WHERE id = ?';
    params.push(id);

    await dbRun(updateQuery, params);
    res.json({ message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/games/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM user_account_access WHERE steam_account_id = ?', [id]);
    await dbRun('DELETE FROM keys WHERE steam_account_id = ?', [id]);
    await dbRun('DELETE FROM steam_accounts WHERE id = ?', [id]);
    res.json({ message: 'Xoá thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/keys', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const keys = await dbAll('SELECT keys.*, steam_accounts.game_name FROM keys LEFT JOIN steam_accounts ON keys.steam_account_id = steam_accounts.id ORDER BY keys.id DESC');
    res.json(keys);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/keys', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type, steam_account_id, amount, duration } = req.body;
    let createdKeys = [];
    const num = amount ? parseInt(amount) : 1;
    const dur = duration || 'permanent';

    for (let i = 0; i < num; i++) {
        const keyString = 'KEY-' + crypto.randomBytes(8).toString('hex').toUpperCase();
        await dbRun('INSERT INTO keys (key_string, type, steam_account_id, duration) VALUES (?, ?, ?, ?)', [keyString, type, steam_account_id || null, dur]);
        createdKeys.push(keyString);
    }
    
    res.json({ message: `Đã tạo ${num} key thành công`, keys: createdKeys });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/keys/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const key = await dbGet('SELECT * FROM keys WHERE id = ?', [id]);

    if (!key) {
      return res.status(404).json({ error: 'Không tìm thấy key.' });
    }

    if (Number(key.is_used)) {
      return res.status(400).json({ error: 'Key đã sử dụng, không thể xoá.' });
    }

    await dbRun('DELETE FROM keys WHERE id = ?', [id]);
    res.json({ message: 'Xoá key thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Orders
app.get('/api/admin/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const orders = await dbAll('SELECT orders.*, users.username FROM orders LEFT JOIN users ON orders.user_id = users.id ORDER BY orders.id DESC');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SERVICES ROUTES ---
app.get('/api/services', async (req, res) => {
  try {
    const services = await dbAll('SELECT * FROM services ORDER BY id DESC');
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/services', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, price, description, image_url } = req.body;
    const result = await dbRun('INSERT INTO services (name, price, description, image_url) VALUES (?, ?, ?, ?)', [name, price, description, image_url]);
    res.json({ id: result.lastID, message: 'Thêm dịch vụ thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/services/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await dbRun('DELETE FROM services WHERE id = ?', [req.params.id]);
    res.json({ message: 'Xoá thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const frontendDistPath = path.resolve(__dirname, '..', 'frontend', 'dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');

if (fs.existsSync(frontendIndexPath)) {
  app.use(express.static(frontendDistPath));

  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    return res.sendFile(frontendIndexPath);
  });
}

app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
});
