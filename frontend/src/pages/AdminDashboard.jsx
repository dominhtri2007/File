import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Trash,
  Server,
  Key,
  Settings,
  PackageSearch,
  LayoutList,
  FileText,
  Search,
  Pencil,
  X,
} from 'lucide-react';
import api from '../utils/api';

const emptyGame = {
  game_name: '',
  steam_username: '',
  steam_password: '',
  email: '',
  status: 'Active',
  notes: '',
  image_url: '',
  price: '',
  discount: '',
  description: '',
  game_type: 'steam',
  download_link: '',
};

function normalizeMoneyInput(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return `${Number(digits).toLocaleString('vi-VN')}đ`;
}

function percentDiscountLabel(game) {
  if (game.game_type === 'steam') return 'Giảm giá 95%';
  return game.discount ? 'Đang giảm giá' : '';
}

function formatPriceDisplay(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return value;
  return `${Number(digits).toLocaleString('vi-VN')}đ`;
}

function buildGamePayload(game) {
  return {
    ...game,
    price: formatPriceDisplay(game.price),
    discount: formatPriceDisplay(game.discount),
  };
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('games');
  const [games, setGames] = useState([]);
  const [keys, setKeys] = useState([]);
  const [orders, setOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [settingsForm, setSettingsForm] = useState({ zalo: '', facebook: '', guide_html: '' });
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [gameSearchTerm, setGameSearchTerm] = useState('');
  const [keyGameSearchInput, setKeyGameSearchInput] = useState('');
  const [keyGameSearchTerm, setKeyGameSearchTerm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [newGame, setNewGame] = useState(emptyGame);
  const [editingGame, setEditingGame] = useState(null);
  const [newKey, setNewKey] = useState({ type: 'all', steam_account_id: '', amount: 1, duration: 'permanent' });
  const [newService, setNewService] = useState({ name: '', price: '', description: '', image_url: '' });

  const showError = (err, fallback) => {
    setError(err.response?.data?.error || fallback);
  };

  const resetAlerts = () => {
    setMessage('');
    setError('');
  };

  const loadGames = async () => {
    const res = await api.get('/admin/games');
    setGames(res.data);
  };

  const loadKeys = async () => {
    const res = await api.get('/admin/keys');
    setKeys(res.data);
  };

  const loadOrders = async () => {
    const res = await api.get('/admin/orders');
    setOrders(res.data);
  };

  const loadServices = async () => {
    const res = await api.get('/services');
    setServices(res.data);
  };

  const loadSettings = async () => {
    const res = await api.get('/settings');
    setSettingsForm(res.data);
  };

  useEffect(() => {
    const fetchTabData = async () => {
      setLoading(true);
      resetAlerts();
      try {
        if (tab === 'games') await loadGames();
        if (tab === 'keys') {
          await Promise.all([loadKeys(), loadGames()]);
        }
        if (tab === 'orders') await loadOrders();
        if (tab === 'services') await loadServices();
        if (tab === 'settings') await loadSettings();
      } catch (err) {
        showError(err, 'Không tải được dữ liệu quản trị.');
      } finally {
        setLoading(false);
      }
    };

    fetchTabData();
  }, [tab]);

  const filteredGames = useMemo(() => {
    const keyword = gameSearchTerm.trim().toLowerCase();
    if (!keyword) return games;
    return games.filter((game) => {
      const text = [
        game.game_name,
        game.steam_username,
        game.game_type,
        game.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(keyword);
    });
  }, [games, gameSearchTerm]);

  const keyGameOptions = useMemo(() => {
    const keyword = keyGameSearchTerm.trim().toLowerCase();
    const filtered = !keyword
      ? games
      : games.filter((game) => {
          const text = `${game.game_name} ${game.steam_username || ''} ${game.game_type || ''}`.toLowerCase();
          return text.includes(keyword);
        });
    return filtered.sort((a, b) => a.game_name.localeCompare(b.game_name));
  }, [games, keyGameSearchTerm]);

  const filteredOrders = orders.filter(
    (o) =>
      o.order_code.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
      (o.username && o.username.toLowerCase().includes(orderSearchTerm.toLowerCase()))
  );

  const handleAddGame = async (e) => {
    e.preventDefault();
    resetAlerts();
    try {
      await api.post('/admin/games', buildGamePayload(newGame));
      setNewGame(emptyGame);
      setMessage('Đã thêm game vào kho.');
      await loadGames();
    } catch (err) {
      showError(err, 'Không thêm được game.');
    }
  };

  const handleStartEdit = (game) => {
    setEditingGame({
      ...emptyGame,
      ...game,
      price: formatPriceDisplay(game.price),
      discount: formatPriceDisplay(game.discount),
      steam_password: game.steam_password || '',
    });
    resetAlerts();
  };

  const handleUpdateGame = async (e) => {
    e.preventDefault();
    if (!editingGame) return;
    resetAlerts();
    try {
      await api.put(`/admin/games/${editingGame.id}`, buildGamePayload(editingGame));
      setMessage('Đã cập nhật game thành công.');
      setEditingGame(null);
      await loadGames();
    } catch (err) {
      showError(err, 'Không cập nhật được game.');
    }
  };

  const handleDeleteGame = async (id) => {
    if (!window.confirm('Chắc chắn xoá mục này?')) return;
    resetAlerts();
    try {
      await api.delete(`/admin/games/${id}`);
      setMessage('Đã xoá game khỏi kho.');
      await loadGames();
    } catch (err) {
      showError(err, 'Không xoá được game.');
    }
  };

  const handleGenerateKey = async (e) => {
    e.preventDefault();
    resetAlerts();

    if (newKey.type === 'specific' && !newKey.steam_account_id) {
      setError('Vui lòng chọn game trước khi tạo key chỉ định.');
      return;
    }

    try {
      const payload = {
        ...newKey,
        steam_account_id: newKey.type === 'specific' ? Number(newKey.steam_account_id) : '',
        amount: Number(newKey.amount || 1),
      };
      const res = await api.post('/admin/keys', payload);
      setMessage(res.data.message || 'Tạo key thành công.');
      await loadKeys();
    } catch (err) {
      showError(err, 'Không tạo được key.');
    }
  };

  const handleKeyGameSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const keyword = keyGameSearchInput.trim();
    const normalizedKeyword = keyword.toLowerCase();
    const matchedGames = games
      .filter((game) => {
        if (!normalizedKeyword) return true;
        const text = `${game.game_name} ${game.steam_username || ''} ${game.game_type || ''}`.toLowerCase();
        return text.includes(normalizedKeyword);
      })
      .sort((a, b) => a.game_name.localeCompare(b.game_name));

    setKeyGameSearchTerm(keyword);
    setNewKey((prev) => ({
      ...prev,
      steam_account_id: matchedGames.some((game) => String(game.id) === String(prev.steam_account_id))
        ? prev.steam_account_id
        : '',
    }));
  };

  const handleDeleteKey = async (keyId) => {
    if (!window.confirm('Chắc chắn xoá key này?')) return;
    resetAlerts();

    try {
      await api.delete(`/admin/keys/${keyId}`);
      setMessage('Đã xoá key thành công.');
      await loadKeys();
    } catch (err) {
      showError(err, 'Không xoá được key.');
    }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    resetAlerts();
    try {
      await api.post('/admin/services', {
        ...newService,
        price: formatPriceDisplay(newService.price),
      });
      setNewService({ name: '', price: '', description: '', image_url: '' });
      setMessage('Đã thêm dịch vụ thành công.');
      await loadServices();
    } catch (err) {
      showError(err, 'Không thêm được dịch vụ.');
    }
  };

  const handleDeleteService = async (id) => {
    if (!window.confirm('Chắc chắn xóa dịch vụ này?')) return;
    resetAlerts();
    try {
      await api.delete(`/admin/services/${id}`);
      setMessage('Đã xoá dịch vụ.');
      await loadServices();
    } catch (err) {
      showError(err, 'Không xoá được dịch vụ.');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    resetAlerts();
    try {
      await api.post('/settings', settingsForm);
      setMessage('Đã lưu cài đặt hệ thống.');
      await loadSettings();
    } catch (err) {
      showError(err, 'Không lưu được cài đặt.');
    }
  };

  const renderGameForm = (game, setGame, submitLabel, onSubmit) => (
    <form onSubmit={onSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
      <div
        style={{
          gridColumn: '1 / -1',
          background: 'rgba(255,255,255,0.05)',
          padding: '1rem',
          borderRadius: '4px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--steam-blue)', fontWeight: 'bold' }}>
          Loại sản phẩm
        </label>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="radio" name={`game_type_${submitLabel}`} checked={game.game_type === 'steam'} onChange={() => setGame({ ...game, game_type: 'steam' })} />
            Game bản quyền (Tài khoản Steam)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name={`game_type_${submitLabel}`}
              checked={game.game_type === 'crack'}
              onChange={() => setGame({ ...game, game_type: 'crack' })}
            />
            Game crack (Link tải)
          </label>
        </div>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <label>Tên sản phẩm (Tên game)</label>
        <input type="text" className="input-control" value={game.game_name} onChange={(e) => setGame({ ...game, game_name: e.target.value })} required />
      </div>

      <div>
        <label>Link ảnh bìa</label>
        <input type="text" className="input-control" placeholder="https://..." value={game.image_url} onChange={(e) => setGame({ ...game, image_url: e.target.value })} />
      </div>
      <div>
        <label>Giá tiền</label>
        <input
          type="text"
          className="input-control"
          placeholder="VD: 1.000.000đ"
          value={game.price}
          onChange={(e) => setGame({ ...game, price: normalizeMoneyInput(e.target.value) })}
        />
      </div>
      <div>
        <label>Giá giảm</label>
        <input
          type="text"
          className="input-control"
          placeholder="VD: 50.000đ"
          value={game.discount}
          onChange={(e) => setGame({ ...game, discount: normalizeMoneyInput(e.target.value) })}
        />
      </div>
      <div>
        <label>Mô tả</label>
        <input type="text" className="input-control" value={game.description} onChange={(e) => setGame({ ...game, description: e.target.value })} />
      </div>

      <hr style={{ gridColumn: '1 / -1', borderColor: 'rgba(255,255,255,0.1)', margin: '0.5rem 0' }} />

      {game.game_type === 'steam' ? (
        <>
          <div>
            <label>Steam Username</label>
            <input type="text" className="input-control" value={game.steam_username} onChange={(e) => setGame({ ...game, steam_username: e.target.value })} required />
          </div>
          <div>
            <label>Steam Password</label>
            <input type="text" className="input-control" value={game.steam_password} onChange={(e) => setGame({ ...game, steam_password: e.target.value })} required={!editingGame} />
          </div>
        </>
      ) : (
        <div style={{ gridColumn: '1 / -1' }}>
          <label>Link tải game</label>
          <input
            type="text"
            className="input-control"
            placeholder="https://..."
            value={game.download_link}
            onChange={(e) => setGame({ ...game, download_link: e.target.value })}
            required
          />
        </div>
      )}

      <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1', justifyContent: 'center' }}>
        {submitLabel}
      </button>
    </form>
  );

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'games' ? 'btn-primary' : ''}`} onClick={() => setTab('games')}>
          <Server size={18} /> Kho Game/Sản Phẩm
        </button>
        <button className={`btn ${tab === 'keys' ? 'btn-primary' : ''}`} onClick={() => setTab('keys')}>
          <Key size={18} /> Quản Lý Keys
        </button>
        <button className={`btn ${tab === 'orders' ? 'btn-primary' : ''}`} onClick={() => setTab('orders')}>
          <PackageSearch size={18} /> Đơn Hàng
        </button>
        <button className={`btn ${tab === 'services' ? 'btn-primary' : ''}`} onClick={() => setTab('services')}>
          <LayoutList size={18} /> Dịch Vụ Khác
        </button>
        <button className={`btn ${tab === 'settings' ? 'btn-primary' : ''}`} onClick={() => setTab('settings')}>
          <Settings size={18} /> Cài Đặt Hệ Thống
        </button>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert">{error}</div>}
      {loading && <div className="alert alert-success">Đang tải dữ liệu...</div>}

      {tab === 'games' && (
        <>
          <div className="glass-panel" style={{ marginBottom: '2rem' }}>
            <h3>Thêm Sản Phẩm Mới</h3>
            {renderGameForm(newGame, setNewGame, 'Thêm vào kho', handleAddGame)}
          </div>

          <div className="glass-panel" style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Danh Sách Kho Game/Sản phẩm</h3>
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <Search size={18} color="#aaa" style={{ position: 'absolute', top: '12px', left: '14px' }} />
              <input
                type="text"
                className="input-control"
                placeholder="Tìm game theo tên, loại, tài khoản Steam..."
                value={gameSearchTerm}
                onChange={(e) => setGameSearchTerm(e.target.value)}
                style={{ paddingLeft: '42px' }}
              />
            </div>

            <div className="grid">
              {filteredGames.map((game) => (
                <div key={game.id} className="glass-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '0.5rem' }}>
                    <div>
                      <h4>{game.game_name}</h4>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          marginTop: '0.5rem',
                          background: game.game_type === 'crack' ? 'rgba(255, 165, 0, 0.2)' : 'rgba(102, 192, 244, 0.2)',
                          color: game.game_type === 'crack' ? 'orange' : 'var(--steam-blue)',
                        }}
                      >
                        {game.game_type === 'crack' ? 'Game Crack' : 'Bản Quyền'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn" style={{ padding: '0.35rem', borderColor: 'var(--steam-blue)' }} onClick={() => handleStartEdit(game)}>
                        <Pencil size={16} />
                      </button>
                      <button className="btn" style={{ padding: '0.35rem', background: 'rgba(255,0,0,0.2)', borderColor: 'red' }} onClick={() => handleDeleteGame(game.id)}>
                        <Trash size={16} />
                      </button>
                    </div>
                  </div>

                  {game.price && (
                    <p style={{ color: 'var(--steam-green)', fontSize: '0.95rem', marginTop: '0.75rem' }}>
                      Giá: {formatPriceDisplay(game.discount) || formatPriceDisplay(game.price)}
                      {game.discount && (
                        <span style={{ textDecoration: 'line-through', color: '#ffbaba', marginLeft: '0.5rem' }}>
                          {formatPriceDisplay(game.price)}
                        </span>
                      )}
                    </p>
                  )}

                  <p style={{ marginTop: '0.5rem', color: '#cfd8df', fontSize: '0.85rem' }}>{percentDiscountLabel(game)}</p>
                  <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '0.75rem 0' }} />

                  {game.game_type === 'steam' ? (
                    <>
                      <p><small style={{ color: '#aaa' }}>User:</small> {game.steam_username}</p>
                      <p><small style={{ color: '#aaa' }}>Pass:</small> {game.steam_password}</p>
                    </>
                  ) : (
                    <p style={{ wordBreak: 'break-all' }}>
                      <small style={{ color: '#aaa' }}>Link tải:</small>{' '}
                      <a href={game.download_link} target="_blank" rel="noreferrer" style={{ color: 'var(--steam-blue)' }}>
                        {game.download_link}
                      </a>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {editingGame && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.8)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
              }}
            >
              <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
                <button
                  onClick={() => setEditingGame(null)}
                  style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
                >
                  <X size={24} />
                </button>
                <h3>Sửa Sản Phẩm</h3>
                {renderGameForm(editingGame, setEditingGame, 'Lưu chỉnh sửa', handleUpdateGame)}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'keys' && (
        <>
          <div className="glass-panel" style={{ marginBottom: '2rem' }}>
            <h3>Tạo Key Mới</h3>
            <form onSubmit={handleGenerateKey} style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label>Loại Key</label>
                <select className="input-control" value={newKey.type} onChange={(e) => setNewKey({ ...newKey, type: e.target.value, steam_account_id: '' })}>
                  <option value="all">VIP (Tất cả games)</option>
                  <option value="specific">Chỉ định 1 game</option>
                </select>
              </div>

              {newKey.type === 'specific' && (
                <>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <label>Tìm game</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Tìm theo tên game..."
                      value={keyGameSearchInput}
                      onChange={(e) => setKeyGameSearchInput(e.target.value)}
                      onKeyDown={handleKeyGameSearchKeyDown}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <label>Chọn Game</label>
                    <select
                      className="input-control"
                      value={newKey.steam_account_id}
                      onChange={(e) => setNewKey({ ...newKey, steam_account_id: e.target.value })}
                      required
                    >
                      <option value="">-- Chọn Game --</option>
                      {keyGameOptions.map((game) => (
                        <option key={game.id} value={game.id}>
                          {game.game_name} ({game.game_type === 'crack' ? 'Crack' : game.steam_username || 'Steam'})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div style={{ flex: 1, minWidth: '180px' }}>
                <label>Thời gian sử dụng</label>
                <select className="input-control" value={newKey.duration} onChange={(e) => setNewKey({ ...newKey, duration: e.target.value })}>
                  <option value="permanent">Vĩnh viễn</option>
                  <option value="1_day">1 ngày</option>
                  <option value="7_days">7 ngày</option>
                  <option value="1_month">1 tháng</option>
                  <option value="3_months">3 tháng</option>
                  <option value="1_year">1 năm</option>
                </select>
              </div>

              <div style={{ width: '120px' }}>
                <label>Số lượng</label>
                <input type="number" className="input-control" value={newKey.amount} onChange={(e) => setNewKey({ ...newKey, amount: e.target.value })} min="1" max="100" />
              </div>

              <button type="submit" className="btn btn-success">
                <Plus size={18} /> Tạo Key
              </button>
            </form>
          </div>

          <div className="glass-panel">
            <h3>Danh sách key đã tạo</h3>
            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Key</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Loại</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Game</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Thời hạn</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Trạng thái</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <code style={{ color: 'var(--steam-blue)' }}>{key.key_string}</code>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{key.type === 'all' ? 'VIP' : 'Chỉ định game'}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{key.game_name || 'Tất cả game'}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{key.duration || 'permanent'}</td>
                      <td style={{ padding: '0.75rem 0.5rem', color: Number(key.is_used) ? '#ffbaba' : 'var(--steam-green)' }}>
                        {Number(key.is_used) ? 'Đã dùng' : 'Chưa dùng'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        {!Number(key.is_used) ? (
                          <button
                            type="button"
                            className="btn"
                            style={{ padding: '0.35rem 0.55rem', background: 'rgba(255,0,0,0.2)', borderColor: 'red' }}
                            onClick={() => handleDeleteKey(key.id)}
                          >
                            <Trash size={14} />
                          </button>
                        ) : (
                          <span style={{ color: '#777', fontSize: '0.85rem' }}>Đã dùng</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'orders' && (
        <div className="glass-panel" style={{ overflowX: 'auto' }}>
          <h3>Tra cứu đơn hàng</h3>
          <input
            type="text"
            className="input-control"
            placeholder="Tìm mã đơn hàng hoặc tên tài khoản khách..."
            value={orderSearchTerm}
            onChange={(e) => setOrderSearchTerm(e.target.value)}
            style={{ maxWidth: '400px', margin: '1rem 0' }}
          />
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                <th style={{ padding: '0.5rem' }}>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Sản phẩm</th>
                <th>Ngày nhập code</th>
                <th>Ngày hết hạn</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#aaa' }}>
                    Không tìm thấy đơn hàng.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isExpired = order.expires_at && new Date(order.expires_at) < new Date();
                  return (
                    <tr key={order.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.5rem' }}>
                        <code style={{ color: 'var(--steam-blue)' }}>{order.order_code}</code>
                      </td>
                      <td>{order.username}</td>
                      <td>{order.game_name}</td>
                      <td>{new Date(order.redeemed_at).toLocaleString('vi-VN')}</td>
                      <td>{order.expires_at ? new Date(order.expires_at).toLocaleString('vi-VN') : 'Vĩnh viễn'}</td>
                      <td>{isExpired ? <span style={{ color: 'red' }}>Hết hạn</span> : <span style={{ color: 'var(--steam-green)' }}>Đang kích hoạt</span>}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'services' && (
        <>
          <div className="glass-panel" style={{ marginBottom: '2rem' }}>
            <h3>Thêm Dịch Vụ Mới</h3>
            <form onSubmit={handleAddService} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Tên dịch vụ</label>
                <input type="text" className="input-control" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} required />
              </div>
              <div>
                <label>Hình ảnh (URL)</label>
                <input type="text" className="input-control" value={newService.image_url} onChange={(e) => setNewService({ ...newService, image_url: e.target.value })} />
              </div>
              <div>
                <label>Giá tiền</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="VD: 50.000đ"
                  value={newService.price}
                  onChange={(e) => setNewService({ ...newService, price: normalizeMoneyInput(e.target.value) })}
                  required
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Mô tả dịch vụ</label>
                <input type="text" className="input-control" value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1', justifyContent: 'center' }}>
                <Plus size={18} /> Thêm Dịch Vụ
              </button>
            </form>
          </div>

          <h3>Danh sách dịch vụ</h3>
          <div className="grid">
            {services.map((service) => (
              <div key={service.id} className="glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <h4>{service.name}</h4>
                  <button className="btn" style={{ padding: '0.2rem', background: 'rgba(255,0,0,0.2)', borderColor: 'red' }} onClick={() => handleDeleteService(service.id)}>
                    <Trash size={16} />
                  </button>
                </div>
                <p style={{ color: 'var(--steam-green)', fontWeight: 'bold' }}>{formatPriceDisplay(service.price)}</p>
                <p style={{ color: '#aaa', fontSize: '0.9rem' }}>{service.description}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'settings' && (
        <div className="glass-panel">
          <h3>
            <Settings size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> Cài đặt hệ thống
          </h3>
          <form onSubmit={handleSaveSettings} style={{ display: 'grid', gap: '1.5rem', marginTop: '1rem' }}>
            <div style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '4px' }}>
              <h4 style={{ color: 'var(--steam-green)', marginBottom: '1rem' }}>Liên hệ cửa hàng</h4>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <label>Số điện thoại / Link Zalo</label>
                  <input type="text" className="input-control" value={settingsForm.zalo || ''} onChange={(e) => setSettingsForm({ ...settingsForm, zalo: e.target.value })} />
                </div>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <label>Link Facebook</label>
                  <input type="text" className="input-control" value={settingsForm.facebook || ''} onChange={(e) => setSettingsForm({ ...settingsForm, facebook: e.target.value })} />
                </div>
              </div>
            </div>

            <div style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '4px' }}>
              <h4 style={{ color: 'var(--steam-blue)', marginBottom: '1rem' }}>
                <FileText size={18} style={{ verticalAlign: 'middle' }} /> Mã HTML trang hướng dẫn
              </h4>
              <textarea
                className="input-control"
                rows="10"
                placeholder="<h1>Hướng dẫn</h1><p>...</p>"
                value={settingsForm.guide_html || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, guide_html: e.target.value })}
                style={{ resize: 'vertical', fontFamily: 'monospace' }}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: 'fit-content' }}>
              Lưu tất cả thiết lập
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
