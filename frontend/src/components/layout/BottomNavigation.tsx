import { MessageCircle, Search, ShoppingBag, User } from "lucide-react";
import type { View } from "../../types";

interface BottomNavigationProps {
  view: View;
  cartCount: number;
  unreadCount: number;
  authenticated: boolean;
  onHome: () => void;
  onSearch: () => void;
  onCart: () => void;
  onMessages: () => void;
  onAccount: () => void;
}

export function BottomNavigation({
  view,
  cartCount,
  unreadCount,
  authenticated,
  onHome,
  onSearch,
  onCart,
  onMessages,
  onAccount,
}: BottomNavigationProps) {
  const items = [
    {
      label: "Trang chủ",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-5 w-5"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9,22 9,12 15,12 15,22" />
        </svg>
      ),
      action: onHome,
      active: view === "home",
      badge: 0,
    },
    {
      label: "Tìm kiếm",
      icon: <Search size={20} />,
      action: onSearch,
      active: view === "search",
      badge: 0,
    },
    {
      label: "Giỏ hàng",
      icon: <ShoppingBag size={20} />,
      action: onCart,
      active: view === "cart",
      badge: cartCount,
    },
    {
      label: "Tin nhắn",
      icon: <MessageCircle size={20} />,
      action: onMessages,
      active: view === "messages",
      badge: authenticated ? unreadCount : 0,
    },
    {
      label: "Tài khoản",
      icon: <User size={20} />,
      action: onAccount,
      active: false,
      badge: 0,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border bg-background/95 backdrop-blur-md md:hidden">
      {items.map((item) => (
        <button
          type="button"
          key={item.label}
          onClick={item.action}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
            item.active
              ? "text-[#C05A2D]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="relative">
            {item.icon}
            {item.badge > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#C05A2D] text-[9px] font-bold text-white">
                {item.badge}
              </span>
            )}
          </span>
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
