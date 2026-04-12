import { Navigate } from "react-router-dom";
import type { Role } from "../lib/jwt";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ role, children }: { role: Role; children: React.ReactNode }) {
  const { token, role: myRole } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (myRole !== role) return <Navigate to="/login" replace />;
  return <>{children}</>;
}