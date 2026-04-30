import React, { useEffect, useState } from 'react';
import '../login/Login.css';
import Login from '../login/Login';

const ROLE_MAP = {
  ADMIN: 'admin',
  DRIVER: 'driver',
  USER: 'customer',
};

const REGISTER_OPTIONS = [
  { id: 'USER', label: '🙋 Passenger', helper: 'Booking account' },
  { id: 'DRIVER', label: '🚗 Driver', helper: 'Driver onboarding' },
];

const VEHICLE_OPTIONS = [
  { value: 'CAR_4', label: '🚗 4-seat Car' },
  { value: 'CAR_7', label: '🚐 7-seat Car' },
];

const REGISTER_TEST_ACCOUNTS = [
  { role: 'Passenger', identifier: 'user@test.com', password: '123456', toneClass: 'auth-test-chip--user' },
  { role: 'Driver', identifier: 'driver@test.com', password: '123456', toneClass: 'auth-test-chip--driver' },
  { role: 'Admin', identifier: 'admin@taxi.com', password: 'admin123', toneClass: 'auth-test-chip--admin' },
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

const getPathForRole = (role) => {
  const mappedRole = ROLE_MAP[role] || 'customer';

  if (mappedRole === 'driver') {
    return '/driver/login';
  }

  if (mappedRole === 'admin') {
    return '/login';
  }

  return '/customer/home';
};

const CustomerLoginPage = ({ onLogin, defaultMode = 'login' }) => {
  const [mode, setMode] = useState(defaultMode);
  const [accountType, setAccountType] = useState('USER');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('CAR_4');
  const [licensePlate, setLicensePlate] = useState('');
  const [driverLicense, setDriverLicense] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isRegisterMode = mode === 'register';

  if (!isRegisterMode) {
    return <Login onLogin={onLogin} />;
  }

  const clearFeedback = () => {
    setError('');
    setSuccessMessage('');
  };

  const goToCustomerMode = (nextMode) => {
    const nextPath = nextMode === 'register' ? '/customer/register' : '/customer/login';

    setMode(nextMode);
    clearFeedback();

    if (nextMode === 'register') {
      setAccountType('USER');
    }

    if (window.location.pathname !== nextPath) {
      if (window.navigateTo) {
        window.navigateTo(nextPath);
      } else {
        window.location.href = nextPath;
      }
    }
  };

  const openPortalLogin = () => {
    if (window.navigateTo) {
      window.navigateTo('/login');
      return;
    }

    window.location.href = '/login';
  };

  const persistSession = (data) => {
    const token = data.accessToken || data.access_token;
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', data.refreshToken || '');
    localStorage.setItem('role', data.account?.role || accountType);
    localStorage.setItem('userId', data.account?.id || '');
  };

  const finalizeAuth = (apiRole, data) => {
    persistSession(data);
    const appRole = ROLE_MAP[apiRole] || 'customer';

    if (onLogin) {
      onLogin(appRole);
      return;
    }

    const nextPath = getPathForRole(apiRole);
    if (window.navigateTo) {
      window.navigateTo(nextPath);
      return;
    }

    window.location.href = nextPath;
  };

  useEffect(() => {
    setMode(defaultMode);
    clearFeedback();
  }, [defaultMode]);

  const handleLogin = async (event) => {
    event.preventDefault();
    clearFeedback();

    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your email or phone and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: normalizeIdentifier(identifier),
          password: password.trim(),
        }),
      });

      const data = await readResponsePayload(res);

      if (!res.ok) {
        setError(data.error || data.message || 'Login failed.');
        return;
      }

      const token = data.accessToken || data.access_token;
      if (!token) {
        setError('Server did not return a valid access token.');
        return;
      }

      finalizeAuth(data.account?.role || 'USER', data);
    } catch (requestError) {
      console.error('Customer login error:', requestError);
      setError('Unable to reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    clearFeedback();

    if (!identifier.trim() || !password.trim() || !confirmPassword.trim()) {
      setError('Please fill in your email/phone and password fields.');
      return;
    }

    if (password.trim().length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password.trim() !== confirmPassword.trim()) {
      setError('Passwords do not match.');
      return;
    }

    if (!fullName.trim() || !phone.trim()) {
      setError('Please complete your full name and phone number.');
      return;
    }

    if (accountType === 'DRIVER' && (!licensePlate.trim() || !driverLicense.trim())) {
      setError('Please provide your vehicle plate and driver license.');
      return;
    }

    setLoading(true);
    try {
      const registerRes = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: normalizeIdentifier(identifier),
          password: password.trim(),
          role: accountType,
          email: identifier.trim().includes('@') ? identifier.trim() : undefined,
        }),
      });

      const registerData = await readResponsePayload(registerRes);

      if (!registerRes.ok) {
        setError(registerData.error || registerData.message || 'Create account failed.');
        return;
      }

      const token = registerData.accessToken || registerData.access_token;
      if (!token) {
        setError('Server did not return a valid access token.');
        return;
      }

      const profilePayload = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        ...(accountType === 'DRIVER'
          ? {
              vehicleType,
              licensePlate: licensePlate.trim(),
              driverLicense: driverLicense.trim(),
            }
          : {}),
      };

      try {
        const profileRes = await fetch('/auth/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(profilePayload),
        });

        if (!profileRes.ok) {
          const profileError = await readResponsePayload(profileRes);
          console.error('Profile setup warning:', profileError.error || profileError.message || 'Unknown error');
        }
      } catch (profileRequestError) {
        console.error('Profile setup warning:', profileRequestError);
      }

      setSuccessMessage(accountType === 'DRIVER' ? 'Driver account created. Redirecting to onboarding...' : 'Passenger account created. Redirecting to booking flow...');
      finalizeAuth(accountType, registerData);
    } catch (requestError) {
      console.error('Customer register error:', requestError);
      setError('Unable to reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className={`auth-card ${isRegisterMode ? 'auth-card--register' : 'auth-card--narrow'}`}>
        <div className="auth-header">
          <div className={`auth-icon-box ${isRegisterMode ? 'auth-icon-box--sparkle' : 'auth-icon-box--taxi'}`} aria-hidden="true">
            {isRegisterMode ? '✨' : '🚖'}
          </div>
          <h1 className="auth-title">{isRegisterMode ? 'Create Account' : 'Welcome Back'}</h1>
          <p className="auth-subtitle">
            {isRegisterMode ? 'Passenger and driver sign up in one clean shared flow' : 'Sign in to your passenger account'}
          </p>
        </div>

        <div className="auth-mode-switch">
          <button type="button" className={`auth-mode-button ${isRegisterMode ? '' : 'auth-mode-button--active'}`} onClick={() => goToCustomerMode('login')}>
            Sign In
          </button>
          <button type="button" className={`auth-mode-button ${isRegisterMode ? 'auth-mode-button--active' : ''}`} onClick={() => goToCustomerMode('register')}>
            Sign Up
          </button>
        </div>

        {isRegisterMode && (
          <div className="auth-register-banner">
            <div className="auth-pill-row">
              <span className="auth-pill auth-pill--user">Passenger Register</span>
              <span className="auth-pill auth-pill--driver">Driver Register</span>
            </div>
            <p className="auth-panel-text">
              Choose the account type below. Passenger and driver both register here, and driver-specific fields appear automatically when needed.
            </p>
          </div>
        )}

        <form className={`auth-form ${isRegisterMode ? 'auth-form--register' : ''}`.trim()} onSubmit={isRegisterMode ? handleRegister : handleLogin}>
          {isRegisterMode ? (
            <>
              <div className="auth-field">
                <label className="auth-label">Register As</label>
                <div className="auth-account-type-grid">
                  {REGISTER_OPTIONS.map((option) => {
                    const isSelected = accountType === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`auth-account-option ${isSelected ? 'auth-account-option--selected' : ''}`}
                        onClick={() => {
                          setAccountType(option.id);
                          clearFeedback();
                        }}
                      >
                        <span className={`auth-radio ${isSelected ? 'auth-radio--selected' : ''}`} aria-hidden="true"></span>
                        <span className="auth-account-option-copy">
                          <span className="auth-account-option-title">{option.label}</span>
                          <span className="auth-account-option-subtitle">{option.helper}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="auth-helper-note">
                  {accountType === 'DRIVER'
                    ? 'Driver uses this same registration form. Vehicle and license details below will be attached to the new driver profile.'
                    : 'Passenger uses this same registration form. Switch to Driver above if you need vehicle and license onboarding.'}
                </p>
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="register-identifier">Email or Phone</label>
                <input
                  id="register-identifier"
                  className="auth-input"
                  type="text"
                  value={identifier}
                  onChange={(event) => {
                    setIdentifier(event.target.value);
                    clearFeedback();
                  }}
                  placeholder="example@gmail.com"
                  autoComplete="username"
                  disabled={loading}
                />
              </div>

              <div className="auth-grid auth-grid--two">
                <div className="auth-field">
                  <label className="auth-label" htmlFor="register-password">Password</label>
                  <input
                    id="register-password"
                    className="auth-input"
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      clearFeedback();
                    }}
                    placeholder="Min 6 chars"
                    autoComplete="new-password"
                    disabled={loading}
                  />
                </div>

                <div className="auth-field">
                  <label className="auth-label" htmlFor="register-confirm-password">Confirm Password</label>
                  <input
                    id="register-confirm-password"
                    className="auth-input"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      clearFeedback();
                    }}
                    placeholder="Re-enter"
                    autoComplete="new-password"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="auth-section">
                <div className="auth-section-title">Personal Info</div>
                <div className="auth-grid auth-grid--two">
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="register-full-name">Full Name</label>
                    <input
                      id="register-full-name"
                      className="auth-input"
                      type="text"
                      value={fullName}
                      onChange={(event) => {
                        setFullName(event.target.value);
                        clearFeedback();
                      }}
                      placeholder="John Doe"
                      autoComplete="name"
                      disabled={loading}
                    />
                  </div>

                  <div className="auth-field">
                    <label className="auth-label" htmlFor="register-phone">Phone</label>
                    <input
                      id="register-phone"
                      className="auth-input"
                      type="tel"
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value);
                        clearFeedback();
                      }}
                      placeholder="0901234567"
                      autoComplete="tel"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {accountType === 'DRIVER' && (
                <div className="auth-highlight-section">
                  <div className="auth-section-title auth-section-title--accent">Vehicle & License</div>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="register-vehicle-type">Vehicle Type</label>
                    <select
                      id="register-vehicle-type"
                      className="auth-select"
                      value={vehicleType}
                      onChange={(event) => {
                        setVehicleType(event.target.value);
                        clearFeedback();
                      }}
                      disabled={loading}
                    >
                      {VEHICLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="auth-grid auth-grid--two">
                    <div className="auth-field">
                      <label className="auth-label" htmlFor="register-license-plate">License Plate</label>
                      <input
                        id="register-license-plate"
                        className="auth-input"
                        type="text"
                        value={licensePlate}
                        onChange={(event) => {
                          setLicensePlate(event.target.value);
                          clearFeedback();
                        }}
                        placeholder="51A-123.45"
                        disabled={loading}
                      />
                    </div>

                    <div className="auth-field">
                      <label className="auth-label" htmlFor="register-driver-license">Driver License</label>
                      <input
                        id="register-driver-license"
                        className="auth-input"
                        type="text"
                        value={driverLicense}
                        onChange={(event) => {
                          setDriverLicense(event.target.value);
                          clearFeedback();
                        }}
                        placeholder="012345678901"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="auth-field">
                <label className="auth-label" htmlFor="customer-login-identifier">Email or Phone</label>
                <input
                  id="customer-login-identifier"
                  className="auth-input"
                  type="text"
                  value={identifier}
                  onChange={(event) => {
                    setIdentifier(event.target.value);
                    clearFeedback();
                  }}
                  placeholder="example@gmail.com"
                  autoComplete="username"
                  disabled={loading}
                />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="customer-login-password">Password</label>
                <input
                  id="customer-login-password"
                  className="auth-input"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearFeedback();
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
            </>
          )}

          {successMessage && <div className="auth-alert auth-alert--success">{successMessage}</div>}
          {error && <div className="auth-alert auth-alert--error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? (isRegisterMode ? 'Creating Account...' : 'Signing In...') : (isRegisterMode ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <p className="auth-switch-text">
          {isRegisterMode ? (
            <>
              Already have an account?{' '}
              <button type="button" className="auth-link-button" onClick={() => goToCustomerMode('login')}>
                Sign In
              </button>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <button type="button" className="auth-link-button" onClick={() => goToCustomerMode('register')}>
                Sign Up
              </button>
            </>
          )}
        </p>

        {isRegisterMode && (
          <div className="auth-register-preview-grid">
            <div className="auth-preview-card auth-preview-card--blue">
              <div className="auth-preview-title">Shared Sign Up</div>
              <div className="auth-preview-item">Passenger and driver both use this same page.</div>
              <div className="auth-preview-item">Switching to Driver only opens the extra vehicle and license fields.</div>
              <div className="auth-preview-item">After sign up, the app routes to the correct flow based on role.</div>
            </div>

            <div className="auth-preview-card auth-preview-card--teal">
              <div className="auth-preview-title">Quick Test Sign In</div>
              {REGISTER_TEST_ACCOUNTS.map((account) => (
                <div key={account.role} className="auth-preview-account-row">
                  <span className={`auth-test-chip ${account.toneClass}`}>{account.role}</span>
                  <div className="auth-preview-account-copy">
                    <div>{account.identifier}</div>
                    <div>{account.password}</div>
                  </div>
                </div>
              ))}
              <button type="button" className="auth-secondary-button auth-secondary-button--ghost" onClick={() => goToCustomerMode('login')}>
                Go To Shared Sign In
              </button>
            </div>
          </div>
        )}

        {!isRegisterMode && (
          <div className="auth-test-box">
            <div className="auth-test-title">🔑 Passenger Test Account</div>
            <div className="auth-test-row"><strong>Passenger:</strong> user@test.com / 123456</div>
            <div className="auth-test-row"><strong>Driver/Admin:</strong> use the portal sign in above</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerLoginPage;
