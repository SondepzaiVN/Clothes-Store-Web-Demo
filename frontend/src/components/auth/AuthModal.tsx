import { ArrowLeft, ShieldCheck, X } from "lucide-react";
import { DEMO_CUSTOMER } from "../../data/mockData";
import type { AuthForm, AuthMode, AuthStep } from "../../types";

interface AuthModalProps {
  open: boolean;
  mode: AuthMode;
  step: AuthStep;
  form: AuthForm;
  error: string;
  notice: string;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
  onFormChange: (form: AuthForm) => void;
  onBack: () => void;
  onSubmitCredentials: () => void;
  onVerifyOtp: () => void;
}

export function AuthModal({
  open,
  mode,
  step,
  form,
  error,
  notice,
  onClose,
  onModeChange,
  onFormChange,
  onBack,
  onSubmitCredentials,
  onVerifyOtp,
}: AuthModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="relative bg-secondary p-6 text-center">
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full p-1.5 transition-colors hover:bg-muted"
          >
            <X size={15} className="text-muted-foreground" />
          </button>
          <p className="font-['Playfair_Display'] text-2xl font-semibold">DECO</p>
          <p className="mt-1 text-sm text-muted-foreground">Mua sắm thời trang trực tuyến</p>
        </div>

        <div className="p-6">
          {step === "credentials" ? (
            <>
              <div className="mb-5 flex rounded-lg bg-muted p-0.5">
                {(["login", "register"] as AuthMode[]).map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => onModeChange(item)}
                    className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-all ${
                      mode === item
                        ? "bg-white text-foreground shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    {item === "login" ? "Đăng nhập" : "Đăng ký"}
                  </button>
                ))}
              </div>

              {mode === "register" && (
                <>
                  <input
                    placeholder="Họ và tên"
                    value={form.name}
                    onChange={(event) => onFormChange({ ...form, name: event.target.value })}
                    className="mb-3 w-full rounded-lg bg-muted px-3.5 py-2.5 text-sm outline-none ring-[#C05A2D]/30 focus:ring-2"
                  />
                  <input
                    inputMode="tel"
                    placeholder="Số điện thoại"
                    value={form.phone}
                    onChange={(event) => onFormChange({ ...form, phone: event.target.value })}
                    className="mb-3 w-full rounded-lg bg-muted px-3.5 py-2.5 text-sm outline-none ring-[#C05A2D]/30 focus:ring-2"
                  />
                </>
              )}

              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(event) => onFormChange({ ...form, email: event.target.value })}
                className="mb-3 w-full rounded-lg bg-muted px-3.5 py-2.5 text-sm outline-none ring-[#C05A2D]/30 focus:ring-2"
              />
              <input
                type="password"
                placeholder={mode === "register" ? "Tạo mật khẩu" : "Mật khẩu"}
                value={form.password}
                onChange={(event) => onFormChange({ ...form, password: event.target.value })}
                className="mb-3 w-full rounded-lg bg-muted px-3.5 py-2.5 text-sm outline-none ring-[#C05A2D]/30 focus:ring-2"
              />
              {mode === "register" && (
                <input
                  type="password"
                  placeholder="Nhập lại mật khẩu"
                  value={form.confirmPassword}
                  onChange={(event) =>
                    onFormChange({ ...form, confirmPassword: event.target.value })
                  }
                  className="mb-3 w-full rounded-lg bg-muted px-3.5 py-2.5 text-sm outline-none ring-[#C05A2D]/30 focus:ring-2"
                />
              )}
              {notice && (
                <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
                  {notice}
                </p>
              )}
              {error && (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}
              {mode === "login" && (
                <div className="mb-3 rounded-lg border border-dashed border-[#C05A2D]/30 bg-[#C05A2D]/5 px-3 py-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Tài khoản có sẵn dữ liệu kiểm thử</p>
                  <p className="mt-1">{DEMO_CUSTOMER.email} · {DEMO_CUSTOMER.password}</p>
                  <p>OTP: {DEMO_CUSTOMER.otp}</p>
                </div>
              )}
              <button
                type="button"
                onClick={onSubmitCredentials}
                className="w-full rounded-lg bg-[#C05A2D] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#A84D25]"
              >
                Tiếp tục
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onBack}
                className="mb-4 flex items-center gap-1 text-xs text-muted-foreground"
              >
                <ArrowLeft size={13} /> Quay lại
              </button>
              <div className="mb-5 text-center">
                <ShieldCheck size={34} className="mx-auto mb-2 text-[#C05A2D]" />
                <h3 className="font-semibold">Xác thực email</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Nhập mã gồm 6 chữ số đã gửi đến {form.email}
                </p>
              </div>
              <input
                inputMode="numeric"
                maxLength={6}
                placeholder="Nhập OTP"
                value={form.otp}
                onChange={(event) =>
                  onFormChange({ ...form, otp: event.target.value.replace(/\D/g, "") })
                }
                className="mb-3 w-full rounded-lg bg-muted px-3.5 py-3 text-center font-semibold tracking-[0.5em] outline-none ring-[#C05A2D]/30 focus:ring-2"
              />
              {notice && (
                <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  {notice}
                </p>
              )}
              {error && (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={onVerifyOtp}
                className="w-full rounded-lg bg-[#C05A2D] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#A84D25]"
              >
                Xác nhận OTP
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
