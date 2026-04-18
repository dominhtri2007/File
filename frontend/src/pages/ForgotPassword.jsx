import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devCode, setDevCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [resetting, setResetting] = useState(false);
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
      const res = await api.post('/auth/forgot-password', { email });
      setSuccess(res.data.message);
      if (res.data.dev_code) {
        setDevCode(res.data.dev_code);
        setResetCode(res.data.dev_code);
      }
    } catch (err) {
      setError(getApiError(err, 'Lỗi gửi mã đặt lại mật khẩu.'));
    } finally {
      setSendingCode(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setResetting(true);

    try {
      const res = await api.post('/auth/reset-password', {
        email,
        reset_code: resetCode,
        new_password: newPassword,
      });
      setSuccess(res.data.message);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(getApiError(err, 'Lỗi đặt lại mật khẩu.'));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ maxWidth: '430px', margin: '4rem auto' }} className="glass-panel fade-in">
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Quên Mật Khẩu</h2>

      {error && <div className="alert">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      {devCode && (
        <div className="alert alert-success">
          Mã test local: <strong>{devCode}</strong>. Chỉ bật chế độ này khi phát triển nội bộ.
        </div>
      )}

      <form onSubmit={handleResetPassword}>
        <div className="form-group">
          <label>Email đã đăng ký</label>
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
          <label>Mã xác thực</label>
          <input
            type="text"
            className="input-control"
            value={resetCode}
            onChange={e => setResetCode(e.target.value)}
            placeholder="Nhập mã 6 số trong email"
            required
          />
        </div>

        <div className="form-group">
          <label>Mật khẩu mới</label>
          <input
            type="password"
            className="input-control"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Ít nhất 6 ký tự"
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={resetting}
          style={{ width: '100%', padding: '0.75rem', marginTop: '1rem', justifyContent: 'center' }}
        >
          {resetting ? 'Đang cập nhật...' : 'Đổi Mật Khẩu'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
        <Link to="/login">Quay lại đăng nhập</Link>
      </div>
    </div>
  );
}
