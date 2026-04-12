import React, { useState } from "react";
import { register, updateProfile } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { decodeToken } from "../lib/jwt";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

export function RegisterPage() {
  const { login: setToken } = useAuth();
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"USER" | "DRIVER">("USER");
  const [customId, _setCustomId] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState<"CAR_4" | "CAR_7">("CAR_4");
  const [licensePlate, setLicensePlate] = useState("");
  const [driverLicense, setDriverLicense] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!identifier || !password) { setErr("Please fill in all fields"); return; }
    if (password !== confirmPassword) { setErr("Passwords do not match"); return; }
    if (password.length < 6) { setErr("Password must be at least 6 characters"); return; }
    if (!fullName.trim()) { setErr("Please enter your full name"); return; }
    if (!phone.trim()) { setErr("Please enter your phone number"); return; }
    if (role === "DRIVER" && !licensePlate.trim()) { setErr("Please enter license plate"); return; }
    if (role === "DRIVER" && !driverLicense.trim()) { setErr("Please enter driver license number"); return; }

    setLoading(true);
    try {
      const userId = role === "USER" ? (customId || `u${Date.now()}`) : undefined;
      const driverId = role === "DRIVER" ? (customId || `d${Date.now()}`) : undefined;
      const resp = await register({ identifier, password, role, userId, driverId });
      setToken(resp.accessToken);
      try {
        if (role === "USER") {
          await updateProfile({ fullName: fullName.trim(), phone: phone.trim() });
        } else {
          await updateProfile({ fullName: fullName.trim(), phone: phone.trim(), vehicleType, licensePlate: licensePlate.trim() || undefined, driverLicense: driverLicense.trim() || undefined });
        }
      } catch {}
      const claims = decodeToken(resp.accessToken);
      if (claims.role === "DRIVER") nav("/driver");
      else nav("/user");
    } catch (e: any) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen gradient-primary flex items-center justify-center p-5">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">✨</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-500 text-sm mt-1">Sign up to get started</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Account Type</label>
            <div className="grid grid-cols-2 gap-3">
              {(["USER", "DRIVER"] as const).map((r) => (
                <label key={r} className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${role === r ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="accent-indigo-600" />
                  <span className="font-medium text-sm">{r === "USER" ? "🙋 Passenger" : "🚗 Driver"}</span>
                </label>
              ))}
            </div>
          </div>

          <Input label="Email or Phone" placeholder="example@gmail.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Password" type="password" placeholder="Min 6 chars" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Input label="Confirm Password" type="password" placeholder="Re-enter" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>

          {/* Personal Info */}
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Personal Info</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Full Name" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <Input label="Phone" type="tel" placeholder="0901234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          {/* Driver-only */}
          {role === "DRIVER" && (
            <div className="bg-purple-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Vehicle & License</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value as "CAR_4" | "CAR_7")} className="w-full p-2.5 rounded-lg border-2 border-gray-200 text-sm focus:border-purple-500 outline-none">
                  <option value="CAR_4">🚗 4-seat Car</option>
                  <option value="CAR_7">🚐 7-seat Car</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="License Plate" placeholder="51A-123.45" value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} />
                <Input label="Driver License" placeholder="012345678901" value={driverLicense} onChange={(e) => setDriverLicense(e.target.value)} />
              </div>
            </div>
          )}

          {err && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">⚠️ {err}</div>
          )}
          <Button type="submit" loading={loading} fullWidth size="lg">Create Account</Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-600 font-semibold hover:text-indigo-500">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
