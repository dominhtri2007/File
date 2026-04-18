import React, { useEffect, useState } from 'react';
import { Copy, Lock, Unlock, KeyRound, ShoppingCart, X, CheckCircle2, Search, Tag } from 'lucide-react';
import api from '../utils/api';

function formatPrice(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return value;
  return `${Number(digits).toLocaleString('vi-VN')}đ`;
}

export default function CustomerPortal() {
  const [games, setGames] = useState([]);
  const [settings, setSettings] = useState({});
  const [redeemKey, setRedeemKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [revealedGames, setRevealedGames] = useState({});
  const [successOrderInfo, setSuccessOrderInfo] = useState(null);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [selectedGameToBuy, setSelectedGameToBuy] = useState(null);

  const fetchGames = async () => {
    try {
      const res = await api.get('/games');
      setGames(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchGames();
    fetchSettings();
  }, []);

  const handleRedeem = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const res = await api.post('/keys/redeem', { key: redeemKey });
      setMessage(res.data.message);
      if (res.data.order_code) setSuccessOrderInfo(res.data.order_code);
      setRedeemKey('');
      fetchGames();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi đổi key');
    }
  };

  const copyToClipboard = (text) => navigator.clipboard.writeText(text);
  const openBuyModal = (game) => {
    setSelectedGameToBuy(game);
    setIsBuyModalOpen(true);
  };
  const handleReveal = (gameId) => setRevealedGames((prev) => ({ ...prev, [gameId]: true }));

  const baseGames = games.filter((game) => !game.game_type || game.game_type === 'steam');
  const filteredGames = baseGames.filter((game) => game.game_name.toLowerCase().includes(searchTerm.toLowerCase()));
  const ownedGames = filteredGames.filter((game) => game.is_owned);
  const lockedGames = filteredGames.filter((game) => !game.is_owned);

  return (
    <div className="fade-in">
      <div className="glass-panel" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3>Mở Khóa Game Mới</h3>
          <p style={{ color: '#aaa', fontSize: '0.9rem', marginTop: '0.5rem' }}>Bạn có key mới? Nhập vào đây để mở khóa.</p>
        </div>
        <form onSubmit={handleRedeem} style={{ display: 'flex', gap: '0.5rem', flex: '1', minWidth: '300px', maxWidth: '400px' }}>
          <input
            type="text"
            className="input-control"
            placeholder="Nhập redeem key..."
            value={redeemKey}
            onChange={(e) => setRedeemKey(e.target.value)}
            required
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-success">
            <KeyRound size={18} /> Đổi Key
          </button>
        </form>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert">{error}</div>}

      <div style={{ marginBottom: '2rem', position: 'relative' }}>
        <Search size={20} color="#aaa" style={{ position: 'absolute', top: '12px', left: '15px' }} />
        <input
          type="text"
          className="input-control"
          placeholder="Tìm kiếm game..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', paddingLeft: '45px', fontSize: '1.1rem', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', borderColor: 'rgba(255,255,255,0.1)' }}
        />
      </div>

      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--steam-green)' }}>
        <Unlock /> Game Sở Hữu ({ownedGames.length})
      </h2>
      <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '1rem 0' }} />

      {ownedGames.length === 0 ? (
        <p style={{ color: '#aaa', fontStyle: 'italic' }}>Bạn chưa sở hữu game nào. Hãy đổi key để mở khóa.</p>
      ) : (
        <div className="grid">
          {ownedGames.map((game) => (
            <div key={game.id} className="glass-panel fade-in" style={{ borderColor: 'var(--steam-green)', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
              {game.image_url ? (
                <img src={game.image_url} alt={game.game_name} style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '150px', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={48} color="var(--steam-green)" opacity="0.3" />
                </div>
              )}

              <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0 }}>{game.game_name}</h3>
                  <div style={{ fontSize: '0.8rem', color: game.expires_at ? '#ffbaba' : 'var(--steam-green)', textAlign: 'right' }}>
                    {game.expires_at ? `Hết hạn: ${new Date(game.expires_at).toLocaleDateString('vi-VN')}` : 'Vĩnh viễn'}
                  </div>
                </div>

                {!revealedGames[game.id] ? (
                  <div style={{ marginTop: 'auto', textAlign: 'center' }}>
                    <button onClick={() => handleReveal(game.id)} className="btn btn-success" style={{ width: '100%', justifyContent: 'center' }}>
                      Lấy Game
                    </button>
                  </div>
                ) : (
                  <div className="fade-in" style={{ marginTop: 'auto' }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <small style={{ color: '#aaa' }}>Username</small>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                        <input type="text" className="input-control" value={game.steam_username} readOnly />
                        <button className="btn" onClick={() => copyToClipboard(game.steam_username)} title="Copy Username">
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <small style={{ color: '#aaa' }}>Password</small>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                        <input type="password" className="input-control" value={game.steam_password} readOnly />
                        <button className="btn" onClick={() => copyToClipboard(game.steam_password)} title="Copy Password">
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,165,0,0.1)', border: '1px solid orange', padding: '0.75rem', borderRadius: '4px', marginTop: '1rem' }}>
                      <p style={{ color: 'orange', fontSize: '0.85rem', margin: 0, lineHeight: 1.4 }}>
                        <strong>Ghi chú:</strong> Vì chế độ bảo hành game nên hãy liên hệ Admin để lấy Steam Guard Code.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '4rem', color: '#ffbaba' }}>
        <ShoppingCart /> Cửa Hàng / Kho Game ({lockedGames.length})
      </h2>
      <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '1rem 0' }} />

      <div className="grid">
        {lockedGames.map((game) => (
          <div key={game.id} className="glass-panel fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0', overflow: 'hidden' }}>
            {game.image_url ? (
              <img src={game.image_url} alt={game.game_name} style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '150px', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={48} color="rgba(255,255,255,0.2)" />
              </div>
            )}

            <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>{game.game_name}</h3>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.3rem 0.55rem',
                    borderRadius: '999px',
                    background: 'rgba(255, 59, 48, 0.16)',
                    color: '#ffbaba',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Tag size={14} /> Giảm giá 95%
                </span>
              </div>

              {game.description && <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '1rem', flex: 1 }}>{game.description}</p>}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#aaa', textDecoration: 'line-through' }}>{formatPrice(game.price) || '1.000.000đ'}</div>
                  <div style={{ color: 'var(--steam-green)', fontWeight: 'bold', fontSize: '1.2rem' }}>
                    {formatPrice(game.discount) || '50.000đ'}
                  </div>
                </div>

                <button onClick={() => openBuyModal(game)} className="btn btn-primary" style={{ borderRadius: '2px' }}>
                  <ShoppingCart size={16} /> Mua Ngay
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isBuyModalOpen && (
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
          }}
        >
          <div className="glass-panel fade-in" style={{ width: '90%', maxWidth: '500px', background: 'var(--steam-bg-darker)', position: 'relative' }}>
            <button onClick={() => setIsBuyModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '1rem' }}>
              Mua Game: <span style={{ color: 'var(--steam-blue)' }}>{selectedGameToBuy?.game_name}</span>
            </h2>
            <p style={{ color: '#ccc', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Để mua tựa game này và nhận key kích hoạt, vui lòng liên hệ Admin qua các kênh sau để thanh toán:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {settings.zalo ? (
                <a href={settings.zalo.startsWith('http') ? settings.zalo : `https://zalo.me/${settings.zalo}`} target="_blank" rel="noreferrer" className="btn btn-success" style={{ justifyContent: 'center', padding: '1rem', fontSize: '1.1rem' }}>
                  Liên hệ qua Zalo ({settings.zalo})
                </a>
              ) : null}

              {settings.facebook ? (
                <a href={settings.facebook} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ justifyContent: 'center', padding: '1rem', fontSize: '1.1rem' }}>
                  Liên hệ qua Facebook
                </a>
              ) : null}

              {!settings.zalo && !settings.facebook && <p style={{ color: 'red', textAlign: 'center' }}>Admin chưa cập nhật thông tin liên hệ.</p>}
            </div>

            <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '1.5rem', textAlign: 'center' }}>
              Sau khi thanh toán thành công, Admin sẽ cung cấp cho bạn một mã key. Vui lòng nhập mã đó vào ô “Đổi Key” trên cùng trang này để mở khóa.
            </p>
          </div>
        </div>
      )}

      {successOrderInfo && (
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
          }}
        >
          <div className="glass-panel fade-in" style={{ width: '90%', maxWidth: '400px', background: 'var(--steam-bg-darker)', position: 'relative', textAlign: 'center' }}>
            <div style={{ color: 'var(--steam-green)', marginBottom: '1rem' }}>
              <CheckCircle2 size={48} style={{ margin: '0 auto' }} />
            </div>
            <h2 style={{ marginBottom: '1rem' }}>Đổi Key Thành Công!</h2>

            <p style={{ color: '#ccc', marginBottom: '0.5rem' }}>Mã đơn hàng (bảo hành) của bạn:</p>
            <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h1 style={{ margin: 0, fontSize: '2rem', color: 'var(--steam-blue)', letterSpacing: '2px' }}>{successOrderInfo}</h1>
            </div>

            <button onClick={() => setSuccessOrderInfo(null)} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}>
              Tôi đã lưu mã
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
