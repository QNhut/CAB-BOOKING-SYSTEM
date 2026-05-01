import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getProfile, updateProfile } from "../../api/auth";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import toast from "react-hot-toast";

export function ProfilePage() {
  const { token, logout } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [driverLicense, setDriverLicense] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    getProfile()
      .then((data) => {
        setRole(data.role || "");
        const p = data.profile || {};
        setFullName(p.full_name || "");
        setPhone(p.phone || "");
        setVehicleType(p.vehicle_type || "CAR_4");
        setLicensePlate(p.license_plate || "");
        setDriverLicense(p.driver_license || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        ...(role === "DRIVER" && {
          vehicleType,
          licensePlate: licensePlate.trim() || undefined,
          driverLicense: driverLicense.trim() || undefined,
        }),
      });
      toast.success("Profile updated!");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="gradient-primary text-white px-6 py-5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link to={role === "DRIVER" ? "/driver" : "/user"} className="text-white/80 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-xl font-bold">My Profile</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Avatar */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-4xl">{role === "DRIVER" ? "🚗" : "👤"}</span>
          </div>
          <p className="font-bold text-lg text-gray-900">{fullName || "User"}</p>
          <span className="inline-block mt-1 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium uppercase">{role}</span>
        </div>

        {/* Info */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4">
          <h3 className="font-semibold text-gray-900">Personal Information</h3>
          <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        {role === "DRIVER" && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4">
            <h3 className="font-semibold text-gray-900">Vehicle Info</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
              <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className="w-full rounded-xl border-2 border-gray-200 p-2.5 text-sm focus:border-indigo-500 outline-none">
                <option value="CAR_4">🚗 4-seat Car</option>
                <option value="CAR_7">🚐 7-seat Car</option>
              </select>
            </div>
            <Input label="License Plate" value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} />
            <Input label="Driver License" value={driverLicense} onChange={(e) => setDriverLicense(e.target.value)} />
          </div>
        )}

        <Button onClick={handleSave} loading={saving} fullWidth size="lg">
          Save Changes
        </Button>

        <button onClick={logout} className="w-full py-3 text-red-500 font-medium hover:bg-red-50 rounded-xl transition text-sm">
          Sign Out
        </button>
      </div>
    </div>
  );
}
