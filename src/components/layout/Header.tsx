import { useState } from "react";
import {
  ChevronDown,
  LogOut,
  MessageCircle,
  Package,
  Search,
  ShoppingBag,
} from "lucide-react";
import type { AppUser } from "../../types";

interface HeaderProps {
  user: AppUser | null;
  searchValue: string;
  cartCount: number;
  unreadCount: number;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onHome: () => void;
  onMessages: () => void;
  onCart: () => void;
  onOrders: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

export function Header({
  user,
  searchValue,
  cartCount,
  unreadCount,
  onSearchChange,
  onSearch,
  onHome,
  onMessages,
  onCart,
  onOrders,
  onLogin,
  onLogout,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-14 items-center gap-3">
          <button
            type="button"
            onClick={onHome}
            className="mr-2 shrink-0 font-['Playfair_Display'] text-xl font-bold tracking-wider"
          >
            DECO
          </button>

          <div className="relative max-w-lg flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && onSearch()}
              placeholder="Tìm áo, váy, quần..."
              className="w-full rounded-full bg-secondary py-1.5 pl-9 pr-4 text-sm outline-none ring-[#C05A2D]/30 placeholder:text-muted-foreground focus:ring-2"
            />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onMessages}
              aria-label="Tin nhắn"
              title="Tin nhắn"
              className="relative rounded-full p-2 transition-colors hover:bg-secondary"
            >
              <MessageCircle size={20} />
              {user && unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#C05A2D] text-[9px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onCart}
              aria-label="Giỏ hàng"
              title="Giỏ hàng"
              className="relative rounded-full p-2 transition-colors hover:bg-secondary"
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#C05A2D] text-[9px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>

            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((current) => !current)}
                  className="flex items-center gap-1.5 rounded-full py-1 pl-2 pr-1 transition-colors hover:bg-secondary"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C05A2D] text-xs font-semibold text-white">
                    {user.name[0]?.toUpperCase()}
                  </span>
                  <ChevronDown size={12} className="text-muted-foreground" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 z-50 mt-1 w-52 rounded-xl border border-border bg-card py-1 shadow-lg">
                    <div className="border-b border-border px-3 py-2">
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onOrders();
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted"
                    >
                      <Package size={14} /> Đơn mua của tôi
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onLogout();
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive transition-colors hover:bg-muted"
                    >
                      <LogOut size={14} /> Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onLogin}
                className="rounded-full bg-[#C05A2D] px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#A84D25]"
              >
                Đăng nhập
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
