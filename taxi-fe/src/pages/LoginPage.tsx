import React, { useState } from "react";
import { login } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { decodeToken } from "../lib/jwt";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

export function LoginPage() {
  const { login: setToken } = useAuth();
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const resp = await login(identifier, password);
      setToken(resp.accessToken);
      const claims = decodeToken(resp.accessToken);
      if (claims.role === "ADMIN") nav("/admin");
      else if (claims.role === "DRIVER") nav("/driver");
      else nav("/user");
    } catch (e: any) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen gradient-primary flex items-center justify-center p-5">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🚖</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Email or Phone"
            placeholder="example@gmail.com"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {err && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
              ⚠️ {err}
            </div>
          )}
          <Button type="submit" loading={loading} fullWidth size="lg">
            Sign In
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don't have an account?{" "}
          <Link to="/register" className="text-indigo-600 font-semibold hover:text-indigo-500">
            Sign Up
          </Link>
        </p>

        <div className="mt-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
          <p className="font-semibold text-indigo-700 text-sm mb-2">🔑 Test Accounts</p>
          <div className="text-xs text-gray-600 space-y-1">
            <p>👤 <strong>User:</strong> user@test.com / pass123</p>
            <p>🚗 <strong>Driver:</strong> driver@test.com / pass123</p>
            <p>🔑 <strong>Admin:</strong> admin@taxi.com / admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
}