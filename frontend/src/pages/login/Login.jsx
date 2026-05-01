import React, { useState } from 'react';
import API_URLS from '../../api/config';
import './Login.css';

const ROLE_MAP = {
  ADMIN: 'admin',
  DRIVER: 'driver',
  USER: 'customer',
};

const VERIFIED_ACCOUNTS = [
  {
    role: 'Passenger',
    identifier: 'user@test.com',
    password: '123456',
    toneClass: 'auth-test-chip--user',
  },
  {
    role: 'Driver',
    identifier: 'driver@test.com',
    password: '123456',
    toneClass: 'auth-test-chip--driver',
  },
  {
    role: 'Admin',
    identifier: 'admin@taxi.com',
    password: 'admin123',
    toneClass: 'auth-test-chip--admin',
  },
];

const ROLE_PILLS = [
  { id: 'user', label: 'User', className: 'auth-pill--user' },
  { id: 'driver', label: 'Driver', className: 'auth-pill--driver' },
  { id: 'admin', label: 'Admin', className: 'auth-pill--admin' },
];

const readResponsePayload = async (response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : {};
};

const normalizeIdentifier = (value) => {
  const trimmed = value.trim();

  if (trimmed.includes('@')) {
    return trimmed;
  }

  if (trimmed.startsWith('0')) {
    return `+84${trimmed.slice(1)}`;
  }

  return trimmed;
};

const Login = ({ onLogin }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const openCustomerAuth = (path) => {
    if (window.navigateTo) {
      window.navigateTo(path);
      return;
    }

    window.location.href = path;
  };

  const applyTestAccount = (account) => {
    setIdentifier(account.identifier);
    setPassword(account.password);
    setError('');
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');

    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your email or phone and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URLS.AUTH}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: normalizeIdentifier(identifier),
          password: password.trim(),
        }),
      });

      const data = await readResponsePayload(res);

      if (!res.ok) {
        setError(data.error || data.message || 'Incorrect credentials.');
        return;
      }

      const token = data.accessToken || data.access_token;
      const apiRole = data.account?.role;
      const appRole = ROLE_MAP[apiRole] || 'customer';

      if (!token) {
        setError('Server did not return a valid access token.');
        return;
      }

      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', data.refreshToken || '');
      localStorage.setItem('role', apiRole || 'USER');
      localStorage.setItem('userId', data.account?.id || '');

      onLogin(appRole);
    } catch (requestError) {
      console.error('Portal login error:', requestError);
      setError('Unable to reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card auth-card--narrow auth-card--portal">
        <div className="auth-header">
          <div className="auth-icon-box auth-icon-box--taxi auth-icon-box--portal" aria-hidden="true">🚖</div>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">One sign in for user, driver, and admin accounts</p>
        </div>

        <div className="auth-mode-switch auth-mode-switch--portal">
          <button type="button" className="auth-mode-button auth-mode-button--active">
            Sign In
          </button>
          <button type="button" className="auth-mode-button" onClick={() => openCustomerAuth('/customer/register')}>
            Sign Up
          </button>
        </div>

        <div className="auth-portal-panel auth-portal-panel--portal">
          <div className="auth-pill-row">
            {ROLE_PILLS.map((role) => (
              <span key={role.id} className={`auth-pill ${role.className}`}>
                {role.label}
              </span>
            ))}
          </div>
          <p className="auth-panel-text">
            Enter one set of credentials here. The backend role decides whether you land in customer booking, driver flow, or admin dashboard.
          </p>
          <div className="auth-inline-actions">
            <button type="button" className="auth-secondary-button auth-secondary-button--ghost" onClick={() => openCustomerAuth('/customer/register')}>
              Open Shared Sign Up
            </button>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="portal-identifier">Email or Phone</label>
            <input
              id="portal-identifier"
              className="auth-input"
              type="text"
              value={identifier}
              onChange={(event) => {
                setIdentifier(event.target.value);
                setError('');
              }}
              placeholder="example@gmail.com"
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="portal-password">Password</label>
            <input
              id="portal-password"
              className="auth-input"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError('');
              }}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && <div className="auth-alert auth-alert--error">{error}</div>}

          <button type="submit" className="auth-submit auth-submit--portal" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-test-box auth-test-box--portal">
          <div className="auth-test-title">🔑 Verified Test Accounts</div>
          <div className="auth-test-grid">
            {VERIFIED_ACCOUNTS.map((account) => (
              <button
                key={account.role}
                type="button"
                className="auth-test-account"
                onClick={() => applyTestAccount(account)}
              >
                <span className={`auth-test-chip ${account.toneClass}`}>{account.role}</span>
                <div className="auth-test-account-id">{account.identifier}</div>
                <div className="auth-test-account-pass">{account.password}</div>
                <div className="auth-test-account-cta">Use this account</div>
              </button>
            ))}
          </div>
          <div className="auth-test-footnote">
            Driver test account is now provided directly by the backend seed and can sign in on this shared form.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
