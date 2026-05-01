import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { UserDashboard } from "./pages/user/UserDashboard";
import { DriverDashboard } from "./pages/driver/DriverDashboard";
import { DriverHistoryPage } from "./pages/driver/DriverHistoryPage";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { useAuth } from "./auth/AuthContext";
import { PaymentReturn } from "./pages/PaymentReturn";
import { SplashPage } from "./pages/SplashPage";
import { RideHistoryPage } from "./pages/user/RideHistoryPage";
import { RatingPage } from "./pages/user/RatingPage";
import { ProfilePage } from "./pages/user/ProfilePage";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { Toaster } from "react-hot-toast";

function Home() {
  const { role } = useAuth();
  if (role === "DRIVER") return <Navigate to="/driver" replace />;
  if (role === "USER") return <Navigate to="/user" replace />;
  if (role === "ADMIN") return <Navigate to="/admin" replace />;
  return <SplashPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* User routes */}
        <Route path="/user" element={<ProtectedRoute role="USER"><UserDashboard /></ProtectedRoute>} />
        <Route path="/user/history" element={<ProtectedRoute role="USER"><RideHistoryPage /></ProtectedRoute>} />
        <Route path="/user/rating/:rideId" element={<ProtectedRoute role="USER"><RatingPage /></ProtectedRoute>} />
        <Route path="/user/profile" element={<ProtectedRoute role="USER"><ProfilePage /></ProtectedRoute>} />

        {/* Driver routes */}
        <Route path="/driver" element={<ProtectedRoute role="DRIVER"><DriverDashboard /></ProtectedRoute>} />
        <Route path="/driver/history" element={<ProtectedRoute role="DRIVER"><DriverHistoryPage /></ProtectedRoute>} />

        {/* Admin routes */}
        <Route path="/admin/*" element={<ProtectedRoute role="ADMIN"><AdminDashboard /></ProtectedRoute>} />

        {/* VNPay return URL — accessible without login */}
        <Route path="/payment/return" element={<PaymentReturn />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}