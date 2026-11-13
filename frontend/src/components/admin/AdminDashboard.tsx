import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  Palette,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Tags,
  X,
} from "lucide-react";
import { BASE_PRODUCTS } from "../../data/mockData";
import type { Product } from "../../types";
import { formatCurrency } from "../../utils/format";
import { completeOrder, databaseApiEnabled, getAdminOrders, updateOrderStatus } from "../../services/decoApi";

type AdminSection = "overview" | "products" | "attributes" | "orders" | "history";
type ProductStatus = "active" | "hidden";

interface AdminProduct extends Product {
  sku: string;
  status: ProductStatus;
  totalStock: number;
  variantCount: number;
}

interface Variant {
  id: string;
  productId: string;
  size: string;
  color: string;
  colorHex: string;
  sku: string;
  stock: number;
  active: boolean;
}

const COLOR_HEX: Record<string, string> = {
  Trắng: "#F7F4EF", Kem: "#E9DDC5", "Xanh nhạt": "#9CB9C8", "Hồng phấn": "#E8B7B7",
  "Xanh sage": "#9CAF9A", Vàng: "#D6AF58", Be: "#C9AE8A", Đen: "#24211F", Xám: "#8D8985",
  "Nâu đất": "#8B5E45", Navy: "#243650", "Đỏ đô": "#7B2638", Champagne: "#D7C0A3",
};

const adminProducts: AdminProduct[] = BASE_PRODUCTS.map((product, index) => ({
  ...product,
  sku: `DECO-${String(index + 1).padStart(3, "0")}`,
  status: index === 7 ? "hidden" : "active",
  totalStock: product.variants.reduce((total, variant) => total + variant.stock, 0),
  variantCount: product.variants.length,
}));

const buildVariants = (product: AdminProduct): Variant[] =>
  product.variants.map((variant) => ({
    id: variant.id,
    productId: product.id,
    size: variant.size,
    color: variant.color,
    colorHex: COLOR_HEX[variant.color] || "#B48A78",
    sku: variant.sku,
    stock: variant.stock,
    active: variant.isActive,
  }));

const initialVariants = adminProducts.flatMap(buildVariants);

const mockOrders = [
  { id: "DECO-000128", customer: "Nguyễn Minh Anh", items: 2, total: 705000, status: "Chờ xác nhận", tone: "amber", time: "10 phút trước" },
  { id: "DECO-000127", customer: "Trần Hoàng Nam", items: 1, total: 350000, status: "Chuẩn bị hàng", tone: "blue", time: "35 phút trước" },
  { id: "DECO-000126", customer: "Lê Thanh Thảo", items: 3, total: 1105000, status: "Đang giao", tone: "purple", time: "2 giờ trước" },
  { id: "DECO-000125", customer: "Phạm Gia Hân", items: 1, total: 285000, status: "Hoàn thành", tone: "green", time: "Hôm qua" },
];

const priceHistory = [
  { product: "Áo Linen Trắng Cổ V", oldPrice: 320000, newPrice: 285000, user: "Admin DECO", time: "03/11/2026 · 09:42" },
  { product: "Quần Wide Leg Kaki", oldPrice: 390000, newPrice: 350000, user: "Admin DECO", time: "02/11/2026 · 15:18" },
  { product: "Đầm Suông Lụa Satin", oldPrice: 720000, newPrice: 680000, user: "Admin DECO", time: "01/11/2026 · 11:05" },
];

const statusHistory = [
  { order: "DECO-000127", from: "Chờ xác nhận", to: "Chuẩn bị hàng", user: "Admin DECO", time: "03/11/2026 · 10:14" },
  { order: "DECO-000126", from: "Chuẩn bị hàng", to: "Đang giao", user: "Admin DECO", time: "03/11/2026 · 08:30" },
  { order: "DECO-000125", from: "Đang giao", to: "Hoàn thành", user: "Admin DECO", time: "02/11/2026 · 17:20" },
];

const sections = [
  { id: "overview" as const, label: "Tổng quan", icon: LayoutDashboard },
  { id: "products" as const, label: "Sản phẩm", icon: Package },
  { id: "attributes" as const, label: "Size & màu sắc", icon: Palette },
  { id: "orders" as const, label: "Đơn hàng", icon: ShoppingBag },
  { id: "history" as const, label: "Lịch sử thay đổi", icon: History },
];

const fieldClass = "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#C05A2D] focus:ring-2 focus:ring-[#C05A2D]/10";

export function AdminDashboard({ adminUserId: _adminUserId, onExit, onLogout }: { adminUserId: number; onExit: () => void; onLogout: () => void }) {
  const [section, setSection] = useState<AdminSection>("overview");
  const [products, setProducts] = useState(adminProducts);
  const [variants, setVariants] = useState(initialVariants);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyTab, setHistoryTab] = useState<"price" | "order">("price");
  const [showCreate, setShowCreate] = useState(false);
  const [newColor, setNewColor] = useState("");
  const [colors, setColors] = useState([
    ["Đen", "#24211F"], ["Trắng", "#F7F4EF"], ["Kem", "#E9DDC5"], ["Xanh navy", "#243650"],
    ["Hồng phấn", "#E8B7B7"], ["Nâu đất", "#8B5E45"], ["Xám", "#8D8985"], ["Đỏ đô", "#7B2638"],
  ]);

  const selectedProduct = products.find((product) => product.id === selectedProductId) || null;
  const selectedVariants = variants.filter((variant) => variant.productId === selectedProductId);
  const filteredProducts = useMemo(() => products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const lowStock = variants.filter((variant) => variant.stock <= 3).length;

  const navigate = (next: AdminSection) => {
    setSection(next);
    setSelectedProductId(null);
    setSidebarOpen(false);
  };

  const updateProduct = (changes: Partial<AdminProduct>) => {
    if (!selectedProductId) return;
    setProducts((current) => current.map((product) => product.id === selectedProductId ? { ...product, ...changes } : product));
  };

  return (
    <div className="min-h-screen bg-[#F7F2EB] font-['DM_Sans'] text-foreground lg:grid lg:grid-cols-[248px_1fr]">
      {sidebarOpen && <button aria-label="Đóng menu" className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-[#E8DED3] bg-[#211915] text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}>
        <div className="border-b border-white/10 px-6 py-5">
          <p className="font-['Playfair_Display'] text-2xl font-bold tracking-widest">DECO</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-white/45">Administration</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {sections.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return <button key={item.id} onClick={() => navigate(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${active ? "bg-[#C05A2D] text-white shadow-lg shadow-black/10" : "text-white/65 hover:bg-white/8 hover:text-white"}`}><Icon size={18}/><span>{item.label}</span>{active && <ChevronRight size={14} className="ml-auto"/>}</button>;
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <button onClick={onExit} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/65 transition hover:bg-white/8 hover:text-white"><ArrowLeft size={17}/>Quay lại cửa hàng</button>
          <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/65 transition hover:bg-white/8 hover:text-white"><LogOut size={17}/>Đăng xuất quản trị</button>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/6 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#C05A2D] text-sm font-semibold">A</div>
            <div><p className="text-sm font-medium">Admin DECO</p><p className="text-[11px] text-white/45">Quản trị viên</p></div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-[#E8DED3] bg-[#F7F2EB]/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <button onClick={() => setSidebarOpen(true)} className="mr-3 rounded-lg p-2 hover:bg-white lg:hidden"><Menu size={20}/></button>
          <div><p className="text-xs text-muted-foreground">DECO Admin</p><h1 className="font-['Playfair_Display'] text-lg font-semibold leading-tight">{sections.find((item) => item.id === section)?.label}</h1></div>
          <div className="ml-auto flex items-center gap-2"><span className="hidden rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 sm:block">Hệ thống hoạt động</span><button className="relative rounded-full bg-white p-2.5 shadow-sm"><Clock3 size={17}/><span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#C05A2D]"/></button></div>
        </header>

        <main className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">
          {section === "overview" && <Overview products={products} lowStock={lowStock} onNavigate={navigate}/>} 

          {section === "products" && !selectedProduct && (
            <section>
              <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div><p className="text-sm text-muted-foreground">Quản lý thông tin chung, giá và trạng thái hiển thị</p><h2 className="mt-1 font-['Playfair_Display'] text-2xl font-semibold">Danh sách sản phẩm</h2></div>
                <button onClick={() => setShowCreate(true)} className="flex items-center justify-center gap-2 rounded-xl bg-[#C05A2D] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#A84D25]"><Plus size={17}/>Thêm sản phẩm</button>
              </div>
              <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#E8DED3] bg-white p-3 sm:flex-row">
                <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc mã sản phẩm..." className="w-full rounded-xl bg-[#F7F2EB] py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#C05A2D]/20"/></div>
                <button className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm"><SlidersHorizontal size={16}/>Tất cả trạng thái</button>
              </div>
              <div className="overflow-hidden rounded-2xl border border-[#E8DED3] bg-white shadow-sm">
                <div className="hidden grid-cols-[1.8fr_0.7fr_0.7fr_0.7fr_0.55fr] gap-4 border-b border-border bg-[#FBF8F4] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid"><span>Sản phẩm</span><span>Giá bán</span><span>Biến thể</span><span>Tồn kho</span><span>Trạng thái</span></div>
                {filteredProducts.map((product) => <button key={product.id} onClick={() => setSelectedProductId(product.id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-4 border-b border-border px-4 py-4 text-left transition last:border-0 hover:bg-[#FBF8F4] md:grid-cols-[1.8fr_0.7fr_0.7fr_0.7fr_0.55fr] md:px-5"><div className="flex min-w-0 items-center gap-3"><img src={product.image} alt="" className="h-14 w-12 rounded-lg object-cover"/><div className="min-w-0"><p className="truncate text-sm font-semibold">{product.name}</p><p className="mt-1 text-xs text-muted-foreground">{product.sku} · {product.category}</p></div></div><div className="text-right md:text-left"><p className="text-sm font-semibold text-[#C05A2D]">{formatCurrency(product.price)}</p><p className="mt-1 text-xs text-muted-foreground md:hidden">{product.totalStock} sản phẩm · {product.variantCount} biến thể</p></div><span className="hidden text-sm md:block">{product.variantCount}</span><span className={`hidden text-sm font-medium md:block ${product.totalStock <= 5 ? "text-red-600" : ""}`}>{product.totalStock}</span><span className="hidden md:block"><StatusPill active={product.status === "active"}/></span></button>)}
              </div>
            </section>
          )}

          {section === "products" && selectedProduct && (
            <ProductEditor product={selectedProduct} variants={selectedVariants} onBack={() => setSelectedProductId(null)} onProductChange={updateProduct} onVariantsChange={(next) => setVariants((current) => [...current.filter((item) => item.productId !== selectedProduct.id), ...next])}/>
          )}

          {section === "attributes" && <Attributes colors={colors} newColor={newColor} setNewColor={setNewColor} onAddColor={() => { if (!newColor.trim()) return; setColors((current) => [...current, [newColor.trim(), "#B77A62"]]); setNewColor(""); }}/>} 
          {section === "orders" && <Orders adminUserId={_adminUserId}/>} 
          {section === "history" && <ChangeHistory activeTab={historyTab} onTabChange={setHistoryTab}/>} 
        </main>
      </div>

      {showCreate && <CreateProductModal onClose={() => setShowCreate(false)} onCreate={(name) => { const next: AdminProduct = { ...adminProducts[0], id:`p${Date.now()}`, name, sku:`DECO-${String(products.length + 1).padStart(3,"0")}`, price:0, status:"hidden", totalStock:0, variantCount:0, image:"/images/linen_shirt.png", sizes:[], colors:[], variants:[] }; setProducts((current) => [next, ...current]); setShowCreate(false); }}/>} 
    </div>
  );
}

function Overview({ products, lowStock, onNavigate }: { products: AdminProduct[]; lowStock: number; onNavigate: (section: AdminSection) => void }) {
  const cards = [
    { label: "Sản phẩm đang bán", value: products.filter((p) => p.status === "active").length, note: `${products.length} sản phẩm tổng cộng`, icon: PackageCheck, color: "bg-orange-50 text-[#C05A2D]" },
    { label: "Đơn chờ xử lý", value: 6, note: "2 đơn mới trong hôm nay", icon: ShoppingBag, color: "bg-blue-50 text-blue-600" },
    { label: "Biến thể sắp hết", value: lowStock, note: "Tồn kho từ 3 trở xuống", icon: AlertTriangle, color: "bg-red-50 text-red-600" },
    { label: "Doanh thu hôm nay", value: "4,28tr", note: "+12,4% so với hôm qua", icon: CircleDollarSign, color: "bg-green-50 text-green-600" },
  ];
  return <section>
    <div className="mb-7"><p className="text-sm text-muted-foreground">Thứ Ba, 03 tháng 11 năm 2026</p><h2 className="mt-1 font-['Playfair_Display'] text-3xl font-semibold">Chào buổi sáng, Admin</h2><p className="mt-2 text-sm text-muted-foreground">Đây là tình hình cửa hàng DECO hôm nay.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, note, icon: Icon, color }) => <div key={label} className="rounded-2xl border border-[#E8DED3] bg-white p-5 shadow-sm"><div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon size={20}/></div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-2 text-xs text-muted-foreground">{note}</p></div>)}</div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
      <div className="overflow-hidden rounded-2xl border border-[#E8DED3] bg-white"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h3 className="font-['Playfair_Display'] text-lg font-semibold">Đơn hàng gần đây</h3><p className="text-xs text-muted-foreground">Cập nhật theo thời gian thực</p></div><button onClick={() => onNavigate("orders")} className="text-xs font-medium text-[#C05A2D]">Xem tất cả</button></div>{mockOrders.map((order) => <div key={order.id} className="flex items-center gap-3 border-b border-border px-5 py-4 last:border-0"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F2EB]"><ShoppingBag size={17}/></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{order.id}</p><p className="truncate text-xs text-muted-foreground">{order.customer} · {order.items} sản phẩm</p></div><div className="text-right"><p className="text-sm font-semibold">{formatCurrency(order.total)}</p><p className="text-[11px] text-muted-foreground">{order.time}</p></div></div>)}</div>
      <div className="rounded-2xl border border-[#E8DED3] bg-[#2A201B] p-5 text-white"><div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-[#C05A2D]"><Sparkles size={20}/></div><p className="text-xs uppercase tracking-[0.2em] text-white/45">Database focus</p><h3 className="mt-2 font-['Playfair_Display'] text-xl font-semibold">Mỗi màn hình tương ứng với dữ liệu nào?</h3><div className="mt-5 space-y-3 text-sm text-white/65"><p><b className="text-white">Sản phẩm</b> → Products, Categories</p><p><b className="text-white">Kho hàng</b> → ProductVariants, Sizes, Colors</p><p><b className="text-white">Lịch sử</b> → PriceHistory, OrderStatusHistory</p></div><button onClick={() => onNavigate("products")} className="mt-6 flex items-center gap-2 text-sm font-medium text-[#E59A79]">Khám phá luồng dữ liệu <ChevronRight size={15}/></button></div>
    </div>
  </section>;
}

function ProductEditor({ product, variants, onBack, onProductChange, onVariantsChange }: { product: AdminProduct; variants: Variant[]; onBack: () => void; onProductChange: (changes: Partial<AdminProduct>) => void; onVariantsChange: (variants: Variant[]) => void }) {
  const [tab, setTab] = useState<"info" | "variants">("info");
  const [size, setSize] = useState(product.sizes[0] || "M");
  const [color, setColor] = useState(product.colors[0] || "Đen");
  return <section>
    <button onClick={onBack} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16}/>Danh sách sản phẩm</button>
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center"><div className="flex items-center gap-4"><img src={product.image} className="h-20 w-16 rounded-xl object-cover" alt=""/><div><div className="mb-1 flex items-center gap-2"><span className="text-xs text-muted-foreground">{product.sku}</span><StatusPill active={product.status === "active"}/></div><h2 className="font-['Playfair_Display'] text-2xl font-semibold">{product.name}</h2><p className="mt-1 text-sm text-muted-foreground">{product.category} · {variants.length} biến thể</p></div></div><button onClick={() => onProductChange({ status: product.status === "active" ? "hidden" : "active" })} className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium">{product.status === "active" ? "Ẩn khỏi cửa hàng" : "Hiển thị sản phẩm"}</button></div>
    <div className="mb-5 flex gap-1 rounded-xl bg-[#EDE5DA] p-1 sm:w-fit"><button onClick={() => setTab("info")} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "info" ? "bg-white shadow-sm" : "text-muted-foreground"}`}>Thông tin chung</button><button onClick={() => setTab("variants")} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "variants" ? "bg-white shadow-sm" : "text-muted-foreground"}`}>Size, màu & tồn kho</button></div>
    {tab === "info" ? <div className="grid gap-5 xl:grid-cols-[1fr_330px]"><div className="rounded-2xl border border-[#E8DED3] bg-white p-5 sm:p-6"><h3 className="mb-5 font-['Playfair_Display'] text-lg font-semibold">Thông tin trong bảng Products</h3><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Tên sản phẩm<input value={product.name} onChange={(e) => onProductChange({ name:e.target.value })} className={`${fieldClass} mt-1.5`}/></label><label className="text-sm">Danh mục<select value={product.category} onChange={(e) => onProductChange({ category:e.target.value })} className={`${fieldClass} mt-1.5`}><option>Áo</option><option>Váy</option><option>Quần</option><option>Áo khoác</option></select></label><label className="text-sm">Giá bán<input type="number" value={product.price} onChange={(e) => onProductChange({ price:Number(e.target.value) })} className={`${fieldClass} mt-1.5`}/><span className="mt-1 block text-xs font-normal text-muted-foreground">Thay đổi giá sẽ được ghi vào ProductPriceHistory.</span></label><label className="text-sm">Mã sản phẩm<input value={product.sku} readOnly className={`${fieldClass} mt-1.5 bg-[#F7F2EB] text-muted-foreground`}/></label><label className="text-sm sm:col-span-2">Mô tả<textarea rows={5} value={product.description} onChange={(e) => onProductChange({ description:e.target.value })} className={`${fieldClass} mt-1.5 resize-none`}/></label></div><button className="mt-5 rounded-xl bg-[#C05A2D] px-5 py-2.5 text-sm font-medium text-white">Lưu thay đổi</button></div><aside className="space-y-4"><div className="rounded-2xl border border-[#E8DED3] bg-white p-5"><h3 className="font-semibold">Ảnh đại diện</h3><img src={product.image} className="mt-4 aspect-[4/3] w-full rounded-xl object-cover" alt=""/><button className="mt-3 w-full rounded-xl border border-border py-2 text-sm">Thay ảnh</button></div><div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm text-orange-900"><p className="font-semibold">Quy tắc xóa mềm</p><p className="mt-1 text-xs leading-relaxed text-orange-800">Nút “Ẩn khỏi cửa hàng” chỉ đổi IsActive = 0. Sản phẩm và dữ liệu đơn cũ vẫn được giữ.</p></div></aside></div>
    : <div className="space-y-5"><div className="rounded-2xl border border-[#E8DED3] bg-white p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h3 className="font-['Playfair_Display'] text-lg font-semibold">Thêm biến thể</h3><p className="mt-1 text-xs text-muted-foreground">Mỗi tổ hợp Product + Size + Color chỉ xuất hiện một lần.</p></div><div className="flex flex-wrap gap-2"><select value={size} onChange={(e) => setSize(e.target.value)} className="rounded-xl border border-border px-3 py-2 text-sm">{["XS","S","M","L","XL","XXL"].map((item) => <option key={item}>{item}</option>)}</select><select value={color} onChange={(e) => setColor(e.target.value)} className="rounded-xl border border-border px-3 py-2 text-sm">{["Đen","Trắng","Kem","Xanh navy","Nâu đất"].map((item) => <option key={item}>{item}</option>)}</select><button onClick={() => { if (variants.some((item) => item.size === size && item.color === color)) return; onVariantsChange([...variants, { id:`v-${Date.now()}`, productId:product.id, size, color, colorHex:COLOR_HEX[color] || "#888", sku:`${product.sku}-${color.slice(0,2)}-${size}`.toUpperCase(), stock:0, active:true }]); }} className="flex items-center gap-2 rounded-xl bg-[#C05A2D] px-4 py-2 text-sm font-medium text-white"><Plus size={16}/>Thêm</button></div></div></div><div className="overflow-hidden rounded-2xl border border-[#E8DED3] bg-white"><div className="grid grid-cols-[0.65fr_1fr_1fr_0.7fr_0.4fr] gap-3 border-b border-border bg-[#FBF8F4] px-4 py-3 text-xs font-semibold uppercase text-muted-foreground"><span>Size</span><span>Màu</span><span>SKU</span><span>Tồn kho</span><span></span></div>{variants.map((variant) => <div key={variant.id} className="grid grid-cols-[0.65fr_1fr_1fr_0.7fr_0.4fr] items-center gap-3 border-b border-border px-4 py-3 last:border-0"><span className="text-sm font-semibold">{variant.size}</span><span className="flex items-center gap-2 text-sm"><span className="h-4 w-4 rounded-full border" style={{background:variant.colorHex}}/>{variant.color}</span><span className="truncate font-mono text-xs text-muted-foreground">{variant.sku}</span><input type="number" min={0} value={variant.stock} onChange={(e) => onVariantsChange(variants.map((item) => item.id === variant.id ? { ...item, stock:Math.max(0,Number(e.target.value)) } : item))} className={`w-20 rounded-lg border px-2 py-1.5 text-sm ${variant.stock <= 3 ? "border-red-200 bg-red-50 text-red-700" : "border-border"}`}/><button onClick={() => onVariantsChange(variants.filter((item) => item.id !== variant.id))} className="ml-auto rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"><X size={15}/></button></div>)}</div></div>}
  </section>;
}

function Attributes({ colors, newColor, setNewColor, onAddColor }: { colors: string[][]; newColor: string; setNewColor: (value: string) => void; onAddColor: () => void }) {
  const sizes = ["XS", "S", "M", "L", "XL", "XXL", "S/M", "L/XL", "28", "29", "30", "31"];
  return <section><div className="mb-6"><p className="text-sm text-muted-foreground">Danh mục dùng chung cho mọi sản phẩm</p><h2 className="mt-1 font-['Playfair_Display'] text-2xl font-semibold">Size & màu sắc</h2></div><div className="grid gap-6 xl:grid-cols-2"><div className="rounded-2xl border border-[#E8DED3] bg-white p-5"><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-orange-50 p-2.5 text-[#C05A2D]"><Palette size={20}/></div><div><h3 className="font-semibold">Bảng Colors</h3><p className="text-xs text-muted-foreground">Màu có thể được tái sử dụng cho nhiều sản phẩm</p></div></div><div className="grid gap-2 sm:grid-cols-2">{colors.map(([name, hex]) => <div key={name} className="flex items-center gap-3 rounded-xl border border-border p-3"><span className="h-8 w-8 rounded-full border shadow-inner" style={{background:hex}}/><div className="flex-1"><p className="text-sm font-medium">{name}</p><p className="font-mono text-[11px] text-muted-foreground">{hex}</p></div><Pencil size={14} className="text-muted-foreground"/></div>)}</div><div className="mt-4 flex gap-2"><input value={newColor} onChange={(e) => setNewColor(e.target.value)} placeholder="Tên màu mới..." className={fieldClass}/><button onClick={onAddColor} className="shrink-0 rounded-xl bg-[#C05A2D] px-4 text-white"><Plus size={17}/></button></div></div><div className="rounded-2xl border border-[#E8DED3] bg-white p-5"><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Tags size={20}/></div><div><h3 className="font-semibold">Bảng Sizes</h3><p className="text-xs text-muted-foreground">Gồm size chữ, size số và size ghép</p></div></div><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{sizes.map((size, index) => <div key={size} className="rounded-xl border border-border p-3 text-center"><p className="font-semibold">{size}</p><p className="mt-1 text-[10px] text-muted-foreground">Thứ tự {index + 1}</p></div>)}</div><button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#C05A2D]/50 py-3 text-sm font-medium text-[#C05A2D]"><Plus size={16}/>Thêm size mới</button></div></div><div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><b>Lưu ý:</b> Màu hoặc size xuất hiện ở đây chưa có nghĩa mọi sản phẩm đều sử dụng chúng. Chỉ khi admin tạo một dòng trong <code className="rounded bg-white px-1.5 py-0.5">ProductVariants</code>, chúng mới thuộc về sản phẩm cụ thể.</div></section>;
}

function Orders({ adminUserId }: { adminUserId: number }) {
  const [orders, setOrders] = useState(mockOrders);
  useEffect(() => {
    if (!databaseApiEnabled) return;
    getAdminOrders(adminUserId).then(({ data }) => setOrders(data.map((row) => ({
      id:String(row.OrderID), customer:String(row.RecipientName), items:Number(row.ItemCount), total:Number(row.TotalAmount),
      status:({PENDING:"Chờ xác nhận",PREPARING:"Chuẩn bị hàng",SHIPPING:"Đang giao",COMPLETED:"Hoàn thành",CANCELLED:"Đã hủy"} as Record<string,string>)[String(row.Status)],
      tone:"", time:new Date(String(row.CreatedAt)).toLocaleString("vi-VN"),
    })))).catch(console.warn);
  }, [adminUserId]);
  const changeStatus = async (order: typeof mockOrders[number], label: string) => {
    try {
      if (databaseApiEnabled) {
        if (label === "Hoàn thành") await completeOrder(Number(order.id), adminUserId, true);
        else if (label === "Chuẩn bị hàng" || label === "Đang giao") await updateOrderStatus(Number(order.id), adminUserId, label === "Chuẩn bị hàng" ? "PREPARING" : "SHIPPING");
      }
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status:label } : item));
    } catch (error) { window.alert(error instanceof Error ? error.message : "Không thể cập nhật đơn."); }
  };
  return <section><div className="mb-6"><p className="text-sm text-muted-foreground">Xác nhận và theo dõi quy trình xử lý đơn</p><h2 className="mt-1 font-['Playfair_Display'] text-2xl font-semibold">Quản lý đơn hàng</h2></div><div className="overflow-hidden rounded-2xl border border-[#E8DED3] bg-white"><div className="hidden grid-cols-[0.8fr_1fr_0.5fr_0.75fr_0.9fr] gap-4 border-b border-border bg-[#FBF8F4] px-5 py-3 text-xs font-semibold uppercase text-muted-foreground md:grid"><span>Mã đơn</span><span>Khách hàng</span><span>Sản phẩm</span><span>Tổng tiền</span><span>Trạng thái</span></div>{orders.map((order) => <div key={order.id} className="grid gap-3 border-b border-border px-5 py-4 last:border-0 md:grid-cols-[0.8fr_1fr_0.5fr_0.75fr_0.9fr] md:items-center"><span className="font-mono text-sm font-semibold">{order.id}</span><span className="text-sm">{order.customer}<small className="block text-muted-foreground">{order.time}</small></span><span className="text-sm">{order.items}</span><span className="text-sm font-semibold">{formatCurrency(order.total)}</span><select value={order.status} onChange={(e) => void changeStatus(order,e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm"><option>Chờ xác nhận</option><option>Chuẩn bị hàng</option><option>Đang giao</option><option>Hoàn thành</option><option disabled>Đã hủy</option></select></div>)}</div><p className="mt-3 text-xs text-muted-foreground">Khi trạng thái thay đổi, Trigger sẽ ghi trạng thái cũ và mới vào OrderStatusHistory.</p></section>;
}

function ChangeHistory({ activeTab, onTabChange }: { activeTab: "price" | "order"; onTabChange: (tab: "price" | "order") => void }) {
  return <section><div className="mb-6"><p className="text-sm text-muted-foreground">Dữ liệu kiểm toán được hệ thống tự động ghi lại</p><h2 className="mt-1 font-['Playfair_Display'] text-2xl font-semibold">Lịch sử thay đổi</h2></div><div className="mb-4 flex w-fit gap-1 rounded-xl bg-[#EDE5DA] p-1"><button onClick={() => onTabChange("price")} className={`rounded-lg px-4 py-2 text-sm font-medium ${activeTab === "price" ? "bg-white shadow-sm" : "text-muted-foreground"}`}>Lịch sử giá</button><button onClick={() => onTabChange("order")} className={`rounded-lg px-4 py-2 text-sm font-medium ${activeTab === "order" ? "bg-white shadow-sm" : "text-muted-foreground"}`}>Trạng thái đơn</button></div><div className="overflow-hidden rounded-2xl border border-[#E8DED3] bg-white">{activeTab === "price" ? priceHistory.map((item) => <div key={item.product + item.time} className="grid gap-2 border-b border-border px-5 py-4 last:border-0 sm:grid-cols-[1.4fr_0.7fr_0.7fr_1fr]"><span className="text-sm font-semibold">{item.product}</span><span className="text-sm text-muted-foreground line-through">{formatCurrency(item.oldPrice)}</span><span className="text-sm font-semibold text-[#C05A2D]">{formatCurrency(item.newPrice)}</span><span className="text-xs text-muted-foreground">{item.user}<br/>{item.time}</span></div>) : statusHistory.map((item) => <div key={item.order + item.time} className="grid gap-2 border-b border-border px-5 py-4 last:border-0 sm:grid-cols-[0.8fr_1.6fr_1fr]"><span className="font-mono text-sm font-semibold">{item.order}</span><span className="flex items-center gap-2 text-sm"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{item.from}</span><ChevronRight size={14}/><span className="rounded-full bg-orange-50 px-2 py-1 text-xs text-[#C05A2D]">{item.to}</span></span><span className="text-xs text-muted-foreground">{item.user}<br/>{item.time}</span></div>)}</div><div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm text-orange-900"><b>Liên hệ database:</b> admin không nhập thủ công các dòng lịch sử này. Trigger tạo chúng sau khi giá sản phẩm hoặc trạng thái đơn được cập nhật.</div></section>;
}

function CreateProductModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-2xl bg-[#F7F2EB] p-5 shadow-2xl sm:p-6"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-[#C05A2D]">Products</p><h3 className="font-['Playfair_Display'] text-xl font-semibold">Tạo sản phẩm mới</h3></div><button onClick={onClose} className="rounded-full bg-white p-2"><X size={17}/></button></div><div className="mt-5 space-y-4"><label className="block text-sm">Tên sản phẩm<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Áo sơ mi Oxford" className={`${fieldClass} mt-1.5`}/></label><label className="block text-sm">Danh mục<select className={`${fieldClass} mt-1.5`}><option>Áo</option><option>Váy</option><option>Quần</option><option>Áo khoác</option></select></label><div className="rounded-xl bg-white p-3 text-xs leading-relaxed text-muted-foreground">Sản phẩm mới được tạo ở trạng thái <b>Đang ẩn</b>. Sau đó bạn mở chi tiết để thêm giá, ảnh và các biến thể tồn kho.</div></div><div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm">Hủy</button><button disabled={!name.trim()} onClick={() => onCreate(name.trim())} className="rounded-xl bg-[#C05A2D] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40">Tạo sản phẩm</button></div></div></div>;
}

function StatusPill({ active }: { active: boolean }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{active ? "Đang bán" : "Đang ẩn"}</span>;
}
