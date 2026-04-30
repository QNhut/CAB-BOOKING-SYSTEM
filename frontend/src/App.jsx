import React, { useEffect, useState } from "react";

// ─── Customer & Driver ─────────────────────────────────────────────────────────
import { driverRoutes } from "./pages/driver";
import { customerRoutes } from "./pages/customer";

// ─── Admin ─────────────────────────────────────────────────────────────────────
import AdminLayout from "./components/shared/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Users from "./pages/admin/Users";
import Drivers from "./pages/admin/Drivers";
import Rides from "./pages/admin/Rides";
import Pricing from "./pages/admin/Pricing";
import Monitoring from "./pages/admin/Monitoring";

// ─── Login ─────────────────────────────────────────────────────────────────────
import Login from "./pages/login/Login";

const API_ROLE_TO_APP_ROLE = {
  ADMIN: "admin",
  DRIVER: "driver",
  USER: "customer",
};

const PUBLIC_CUSTOMER_PATHS = new Set([
  "/customer/onboarding",
  "/customer/login",
  "/customer/register",
  "/customer/payment-return",
]);

const SESSION_KEYS_TO_CLEAR = [
  'currentBookingId',
  'pickup',
  'dropoff',
  'tripPrice',
  'driverName',
  'driverId',
  'currentRide',
  'completedFare',
];

const clearStoredSession = () => {
  SESSION_KEYS_TO_CLEAR.forEach((key) => sessionStorage.removeItem(key));
};

const getDefaultPathForRole = (role, isAuthenticated) => {
  if (role === 'customer') {
    return isAuthenticated ? '/customer/home' : '/customer/onboarding';
  }

  if (role === 'driver') {
    return '/driver/login';
  }

  return '/login';
};

const clearStoredAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("role");
  localStorage.removeItem("userId");
  clearStoredSession();
};

const getStoredAppRole = () => {
  const storedRole = localStorage.getItem("role");
  return API_ROLE_TO_APP_ROLE[storedRole] || null;
};

const isTokenExpired = (token) => {
  try {
    const [, payload] = token.split(".");
    if (!payload) return true;
    const decoded = JSON.parse(atob(payload));
    return !decoded.exp || decoded.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

const getStoredAuthState = () => {
  const token = localStorage.getItem("token");
  const userRole = getStoredAppRole();

  if (!token || !userRole || isTokenExpired(token)) {
    clearStoredAuth();
    return { isAuthenticated: false, userRole: null };
  }

  return { isAuthenticated: true, userRole };
};

const normalizePath = (path) => {
  const storedAuth = getStoredAuthState();

  if (path === "/" || path === "") {
    return getDefaultPathForRole(storedAuth.userRole, storedAuth.isAuthenticated);
  }

  if (storedAuth.isAuthenticated && (path === '/login' || PUBLIC_CUSTOMER_PATHS.has(path))) {
    return getDefaultPathForRole(storedAuth.userRole, true);
  }

  return path;
};

export default function App() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => getStoredAuthState().isAuthenticated
  );
  const [userRole, setUserRole] = useState(
    () => getStoredAuthState().userRole
  );

  // ── Admin ───────────────────────────────────────────────────────────────────
  const [activePage, setActivePage] = useState("dashboard");
  const [adminTheme, setAdminTheme] = useState(
    () => localStorage.getItem("admin-theme") || "dark"
  );

  // ── Mobile ──────────────────────────────────────────────────────────────────
  const [mobilePath, setMobilePath] = useState(() =>
    normalizePath(window.location.pathname)
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(
    () =>
      localStorage.getItem("theme") === "dark" ||
      (!("theme" in localStorage) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
  );

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", adminTheme);
    localStorage.setItem("admin-theme", adminTheme);
  }, [adminTheme]);

  useEffect(() => {
    const storedAuth = getStoredAuthState();
    setIsAuthenticated(storedAuth.isAuthenticated);
    setUserRole(storedAuth.userRole);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  useEffect(() => {
    window.navigateTo = (newPath) => {
      window.history.pushState({}, "", newPath);
      window.dispatchEvent(new Event("popstate"));
    };
    const normalized = normalizePath(window.location.pathname);
    if (window.location.pathname !== normalized) {
      window.history.replaceState({}, "", normalized);
    }
    setMobilePath(normalized);
    const handlePopState = () =>
      setMobilePath(normalizePath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      delete window.navigateTo;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || userRole === 'admin') {
      return;
    }

    const routeList = userRole === 'customer' ? customerRoutes : driverRoutes;
    const fallbackPath = getDefaultPathForRole(userRole, true);

    if (!routeList.some((route) => route.path === mobilePath)) {
      window.history.replaceState({}, '', fallbackPath);
      setMobilePath(fallbackPath);
    }
  }, [isAuthenticated, mobilePath, userRole]);

  // ── Auth handlers ────────────────────────────────────────────────────────────
  const handleLogin = (role) => {
    setUserRole(role);
    setIsAuthenticated(true);

    if (role === "admin") {
      setActivePage("dashboard");
    } else {
      const nextPath = getDefaultPathForRole(role, true);
      window.history.replaceState({}, "", nextPath);
      setMobilePath(nextPath);
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch('/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      clearStoredAuth();
      setIsAuthenticated(false);
      setUserRole(null);
      window.location.href = "/";
    }
  };

  // ── Not authenticated → Login ────────────────────────────────────────────────
  if (!isAuthenticated) {
    if (PUBLIC_CUSTOMER_PATHS.has(mobilePath)) {
      const publicRoute = customerRoutes.find((route) => route.path === mobilePath);
      const PublicPage = publicRoute?.component;

      if (PublicPage) {
        return (
          <div className="min-h-screen bg-slate-950 flex justify-center items-center relative overflow-hidden">
            <div className="relative w-full max-w-[400px] h-[100dvh] flex items-center justify-center">
              <PublicPage
                toggleTheme={() => setIsDarkMode(!isDarkMode)}
                isDarkMode={isDarkMode}
                onLogin={handleLogin}
              />
            </div>
          </div>
        );
      }
    }

    return <Login onLogin={handleLogin} />;
  }

  // ── Admin view ───────────────────────────────────────────────────────────────
  if (userRole === "admin") {
    const renderAdminPage = () => {
      switch (activePage) {
        case "dashboard": return <Dashboard onNavigate={setActivePage} />;
        case "users":     return <Users />;
        case "drivers":   return <Drivers />;
        case "rides":     return <Rides />;
        case "pricing":   return <Pricing />;
        case "monitoring":return <Monitoring />;
        default:
          return (
            <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"100%", color:"var(--text-secondary)" }}>
              <h2>Page "{activePage}" đang được xây dựng</h2>
            </div>
          );
      }
    };
    return (
      <AdminLayout
        activePage={activePage}
        onNavigate={setActivePage}
        theme={adminTheme}
        toggleTheme={() => setAdminTheme((t) => (t === "dark" ? "light" : "dark"))}
        userRole={userRole}
        onLogout={handleLogout}
      >
        {renderAdminPage()}
      </AdminLayout>
    );
  }

  // ── Mobile (Customer / Driver) view ─────────────────────────────────────────
  const accentColor = userRole === "customer" ? "blue" : "teal";
  const routeList   = userRole === "customer" ? customerRoutes : driverRoutes;
  const defaultMobilePath = getDefaultPathForRole(userRole, true);
  const currentRoute = routeList.find((route) => route.path === mobilePath)
    ?? routeList.find((route) => route.path === defaultMobilePath)
    ?? routeList[0];
  const CurrentPage = currentRoute.component;

  return (
    <div className="min-h-screen bg-slate-950 flex justify-center items-center relative overflow-hidden">
      {/* ── Device Frame ── */}
      <div className="relative w-full max-w-[400px] h-[100dvh] flex items-center justify-center">

        {/* ── Classic Sidebar Menu (Slide from left) ── */}
        {isMenuOpen && (
          <div className="absolute inset-0 z-[200] flex">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsMenuOpen(false)}
            />
            
            {/* Sidebar Container */}
            <div className="relative w-[80%] max-w-[300px] h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-[slideRight_0.2s_ease-out]">
              <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                <div className={`font-bold text-lg ${accentColor === "customer" ? "text-[#5b21b6] dark:text-blue-400" : "text-teal-600 dark:text-teal-400"}`}>
                  Menu
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {[
                  { label: 'Trang Chủ', path: userRole === 'customer' ? '/customer/home' : '/driver/login' },
                  { label: 'Ví & Thanh Toán', path: userRole === 'customer' ? '/customer/profile' : '/driver/wallet', hasSub: true },
                  { label: 'Lịch Sử Chuyến Đi', path: userRole === 'customer' ? '/customer/history' : '/driver/history', hasSub: true },
                  { label: 'Cài Đặt', path: '#' },
                  { label: 'Hỗ Trợ', path: '#' }
                ].map((item, idx) => {
                  const isActive = mobilePath === item.path;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (item.path !== '#') window.navigateTo(item.path);
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-5 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <span className={`text-base font-semibold ${isActive ? (accentColor === "customer" ? "text-[#5b21b6] dark:text-blue-400" : "text-teal-600 dark:text-teal-400") : "text-slate-800 dark:text-slate-200"}`}>
                        {item.label}
                      </span>
                      {item.hasSub && (
                        <span className="material-symbols-outlined text-slate-400 text-[20px]">arrow_drop_down</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="p-0 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-5 py-4 flex items-center justify-between text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                >
                  <span className="font-semibold">Đăng Xuất</span>
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Page Content ── */}
        <CurrentPage
          toggleMenu={() => setIsMenuOpen(true)}
          toggleTheme={() => setIsDarkMode(!isDarkMode)}
          isDarkMode={isDarkMode}
          onLogout={handleLogout}
        />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideRight { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      `}} />
    </div>
  );
}
