import { Navigate, useNavigate } from "react-router-dom";
import { clearSession, readSession } from "../../services/session";
import { AdminDashboard } from "./AdminDashboard";

export function AdminPortal() {
  const navigate = useNavigate();
  const session = readSession();

  if (session?.role !== "ADMIN") return <Navigate to="/" replace />;

  return (
    <AdminDashboard
      adminUserId={session.databaseUserId}
      onExit={() => navigate("/")}
      onLogout={() => {
        clearSession();
        navigate("/", { replace: true });
      }}
    />
  );
}
