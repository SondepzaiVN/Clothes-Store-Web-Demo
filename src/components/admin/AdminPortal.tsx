import { useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AdminDashboard } from "./AdminDashboard";

const ADMIN_SESSION_KEY = "deco_admin_session";
const DEMO_ADMIN = {
  email: "admin@deco.vn",
  password: "Admin@123",
};

const hasAdminSession = () => sessionStorage.getItem(ADMIN_SESSION_KEY) === "demo-admin";

export function AdminPortal() {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(hasAdminSession);

  const login = () => {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "demo-admin");
    setAuthenticated(true);
    navigate("/admin", { replace: true });
  };

  const logout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setAuthenticated(false);
    navigate("/admin/login", { replace: true });
  };

  return (
    <Routes>
      <Route
        path="login"
        element={authenticated ? <Navigate to="/admin" replace /> : <AdminLogin onLogin={login} />}
      />
      <Route
        index
        element={authenticated
          ? <AdminDashboard onExit={() => navigate("/")} onLogout={logout} />
          : <Navigate to="/admin/login" replace />}
      />
      <Route path="*" element={<Navigate to={authenticated ? "/admin" : "/admin/login"} replace />} />
    </Routes>
  );
}

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (email.trim().toLowerCase() !== DEMO_ADMIN.email || password !== DEMO_ADMIN.password) {
      setError("Email hoặc mật khẩu quản trị không chính xác.");
      return;
    }
    onLogin();
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#211915] p-4 font-['DM_Sans']">
      <div className="absolute -left-40 -top-40 h-[460px] w-[460px] rounded-full bg-[#C05A2D]/20 blur-3xl" />
      <div className="absolute -bottom-48 -right-32 h-[520px] w-[520px] rounded-full bg-[#D4937A]/10 blur-3xl" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#F7F2EB] shadow-2xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden flex-col justify-between bg-[#2A201B] p-10 text-white lg:flex">
          <div>
            <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-white/55 transition hover:text-white"><ArrowLeft size={16}/>Về cửa hàng</button>
            <div className="mt-16 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C05A2D]"><ShieldCheck size={28}/></div>
            <p className="mt-7 text-xs uppercase tracking-[0.25em] text-[#E59A79]">DECO Administration</p>
            <h1 className="mt-3 font-['Playfair_Display'] text-4xl font-semibold leading-tight">Không gian quản trị dành riêng cho đội ngũ DECO.</h1>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/55">Quản lý sản phẩm, biến thể tồn kho, đơn hàng và theo dõi toàn bộ lịch sử thay đổi dữ liệu.</p>
          </div>
          <div className="flex items-center gap-3 border-t border-white/10 pt-6 text-xs text-white/45"><LockKeyhole size={15}/><span>Truy cập giới hạn theo vai trò quản trị viên</span></div>
        </section>

        <section className="p-6 sm:p-10 lg:p-14">
          <button onClick={() => navigate("/")} className="mb-10 flex items-center gap-2 text-sm text-muted-foreground lg:hidden"><ArrowLeft size={16}/>Về cửa hàng</button>
          <div className="mb-8">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C05A2D]/10 text-[#C05A2D] lg:hidden"><ShieldCheck size={24}/></div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C05A2D]">Đăng nhập bảo mật</p>
            <h2 className="mt-2 font-['Playfair_Display'] text-3xl font-semibold">Chào mừng trở lại</h2>
            <p className="mt-2 text-sm text-muted-foreground">Sử dụng tài khoản quản trị để tiếp tục.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium">
              Email quản trị
              <span className="relative mt-1.5 block">
                <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@deco.vn" className="w-full rounded-xl border border-border bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#C05A2D] focus:ring-2 focus:ring-[#C05A2D]/10" />
              </span>
            </label>
            <label className="block text-sm font-medium">
              Mật khẩu
              <span className="relative mt-1.5 block">
                <KeyRound size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhập mật khẩu" className="w-full rounded-xl border border-border bg-white py-3 pl-11 pr-12 text-sm outline-none transition focus:border-[#C05A2D] focus:ring-2 focus:ring-[#C05A2D]/10" />
                <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
              </span>
            </label>

            {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C05A2D] py-3 text-sm font-semibold text-white shadow-lg shadow-[#C05A2D]/15 transition hover:bg-[#A84D25]"><ShieldCheck size={17}/>Đăng nhập quản trị</button>
          </form>

          <div className="mt-6 rounded-xl border border-dashed border-[#C05A2D]/30 bg-[#C05A2D]/5 p-4 text-xs leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">Tài khoản dùng thử cho prototype</p>
            <p className="mt-1">Email: <code className="text-[#C05A2D]">admin@deco.vn</code></p>
            <p>Mật khẩu: <code className="text-[#C05A2D]">Admin@123</code></p>
          </div>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">Bản hiện tại chỉ mô phỏng phiên đăng nhập ở frontend. Khi có backend, thông tin đăng nhập sẽ được xác thực tại server.</p>
        </section>
      </div>
    </main>
  );
}
