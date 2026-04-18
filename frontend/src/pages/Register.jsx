import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devCode, setDevCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [registering, setRegistering] = useState(false);
  const navigate = useNavigate();

  const getApiError = (err, fallback) => {
    if (err.response?.data?.error) return err.response.data.error;
    if (err.code === 'ERR_NETWORK') {
      return 'Không kết nối được máy chủ. Hãy mở backend ở cổng 3001 rồi thử lại.';
    }
    return fallback;
  };

  const handleSendCode = async () => {
    setError('');
    setSuccess('');
    setDevCode('');

    if (!email) {
      setError('Vui lòng nhập email trước.');
      return;
    }

    setSendingCode(true);
    try {
      const res = await api.post('/auth/send-verification', { email });
      setSuccess(res.data.message);
      if (res.data.dev_code) {
        setDevCode(res.data.dev_code);
        setVerificationCode(res.data.dev_code);
      }
    } catch (err) {
      setError(getApiError(err, 'Lỗi gửi mã xác thực.'));
    } finally {
      setSendingCode(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setRegistering(true);

    try {
      const res = await api.post('/auth/register', {
        username,
        email,
        password,
        verification_code: verificationCode,
      });
      setSuccess(res.data.message);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(getApiError(err, 'Lỗi đăng ký tài khoản.'));
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div style={{ maxWidth: '430px', margin: '4rem auto' }} className="glass-panel fade-in">
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Đăng Ký Tài Khoản</h2>

      {error && <div className="alert">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      {devCode && (
        <div className="alert alert-success">
          Mã test local: <strong>{devCode}</strong>. Chỉ bật chế độ này khi phát triển nội bộ.
        </div>
      )}

      <form onSubmit={handleRegister}>
        <div className="form-group">
          <label>Tên đăng nhập</label>
          <input
            type="text"
            className="input-control"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Email</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="email"
              className="input-control"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <button
              type="button"
              className="btn btn-success"
              onClick={handleSendCode}
              disabled={sendingCode}
              style={{ whiteSpace: 'nowrap' }}
            >
              {sendingCode ? 'Đang gửi...' : 'Gửi mã'}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>Mã xác thực email</label>
          <input
            type="text"
            className="input-control"
            value={verificationCode}
            onChange={e => setVerificationCode(e.target.value)}
            placeholder="Nhập mã 6 số trong email"
            required
          />
        </div>

        <div className="form-group">
          <label>Mật khẩu</label>
          <input
            type="password"
            className="input-control"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={registering}
          style={{ width: '100%', padding: '0.75rem', marginTop: '1rem', justifyContent: 'center' }}
        >
          {registering ? 'Đang đăng ký...' : 'Đăng Ký Miễn Phí'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
      </div>
    </div>
  );
}
