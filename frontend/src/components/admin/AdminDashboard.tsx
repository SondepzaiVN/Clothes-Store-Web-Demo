import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowLeft, ChevronRight, Eye, EyeOff, History,
  LayoutDashboard, LoaderCircle, LogOut, Menu, Package, PackageCheck, Palette,
  Plus, RefreshCw, Save, Search, ShoppingBag, Sparkles, Tags, X,
} from "lucide-react";
import { BASE_PRODUCTS } from "../../data/mockData";
import type { Product } from "../../types";
import {
  completeOrder, createAdminProduct, databaseApiEnabled, getAdminOrders,
  getAdminProductDetail, getAdminProducts, getCatalogLookups,
  getOrderStatusHistory, getProductPriceHistory, saveAdminVariant,
  setAdminProductActive, updateAdminProduct, updateAdminProductPrice,
  updateOrderStatus,
} from "../../services/decoApi";
import type {
  CatalogLookups, OrderStatusHistoryRow, PriceHistoryRow,
} from "../../services/decoApi";
import { formatCurrency } from "../../utils/format";

type AdminSection = "overview" | "products" | "attributes" | "orders" | "history";

interface AdminVariant {
  id: string;
  productId: string;
  sizeId: number;
  size: string;
  colorId: number;
  color: string;
  colorHex: string;
  sku: string;
  stock: number;
  active: boolean;
}

interface AdminProduct extends Product {
  categoryId: number;
  primarySku: string;
  persistedPrice: number;
  status: "active" | "hidden";
  totalStock: number;
  variantCount: number;
}

interface AdminOrder {
  id: string;
  code: string;
  customer: string;
  items: number;
  total: number;
  status: string;
  createdAt: string;
}

const EMPTY_LOOKUPS: CatalogLookups = { categories: [], sizes: [], colors: [] };
const fieldClass = "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#C05A2D] focus:ring-2 focus:ring-[#C05A2D]/10";
const sections = [
  { id: "overview" as const, label: "Tổng quan", icon: LayoutDashboard },
  { id: "products" as const, label: "Sản phẩm", icon: Package },
  { id: "attributes" as const, label: "Size & màu sắc", icon: Palette },
  { id: "orders" as const, label: "Đơn hàng", icon: ShoppingBag },
  { id: "history" as const, label: "Lịch sử thay đổi", icon: History },
];
const statusLabels: Record<string, string> = {
  PENDING: "Chờ xác nhận", PREPARING: "Chuẩn bị hàng", SHIPPING: "Đang giao",
  COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy",
};

const fallbackProducts: AdminProduct[] = BASE_PRODUCTS.map((product, index) => ({
  ...product,
  categoryId: index + 1,
  primarySku: product.variants[0]?.sku || `DECO-${index + 1}`,
  persistedPrice: product.price,
  status: product.isActive ? "active" : "hidden",
  totalStock: product.variants.reduce((sum, variant) => sum + variant.stock, 0),
  variantCount: product.variants.length,
}));

const fallbackVariants: AdminVariant[] = fallbackProducts.flatMap((product) =>
  product.variants.map((variant, index) => ({
    id: variant.id, productId: product.id, sizeId: index + 1, size: variant.size,
    colorId: index + 1, color: variant.color, colorHex: "#B48A78",
    sku: variant.sku, stock: variant.stock, active: variant.isActive,
  })),
);

export function AdminDashboard({ adminUserId, onExit, onLogout }: { adminUserId: number; onExit: () => void; onLogout: () => void }) {
  const [section, setSection] = useState<AdminSection>("overview");
  const [products, setProducts] = useState<AdminProduct[]>(fallbackProducts);
  const [variants, setVariants] = useState<AdminVariant[]>(fallbackVariants);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [lookups, setLookups] = useState<CatalogLookups>(EMPTY_LOOKUPS);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(databaseApiEnabled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadProducts = async () => {
    const list = await getAdminProducts(adminUserId);
    const details = await Promise.all(list.data.map((row) => getAdminProductDetail(row.ProductID, adminUserId)));
    const nextVariants: AdminVariant[] = [];
    const nextProducts: AdminProduct[] = list.data.map((row, index) => {
      const detail = details[index];
      const productVariants = detail.variants.map((variant) => {
        const mapped: AdminVariant = {
          id:String(variant.VariantID), productId:String(row.ProductID), sizeId:variant.SizeID,
          size:variant.SizeName, colorId:variant.ColorID, color:variant.ColorName,
          colorHex:variant.HexCode || "#B48A78", sku:variant.SKU,
          stock:Number(variant.StockQuantity), active:Boolean(variant.IsActive),
        };
        nextVariants.push(mapped);
        return { id:mapped.id, sku:mapped.sku, size:mapped.size, color:mapped.color, stock:mapped.stock, isActive:mapped.active };
      });
      return {
        id:String(row.ProductID), categoryId:row.CategoryID, name:row.Name,
        price:Number(row.Price), persistedPrice:Number(row.Price), shopId:"deco", shopName:"DECO Official",
        image:row.PrimaryImageUrl || "/favicon.svg", category:row.CategoryName,
        tags:[row.CategoryName], rating:5, reviews:0, sold:0, description:row.Description || "",
        sizes:[...new Set(productVariants.map((variant) => variant.size))],
        colors:[...new Set(productVariants.map((variant) => variant.color))],
        variants:productVariants, isActive:Boolean(row.IsActive), createdAt:row.CreatedAt,
        primarySku:row.PrimarySKU || `P-${row.ProductID}`, status:row.IsActive ? "active" : "hidden",
        totalStock:Number(row.TotalStock), variantCount:Number(row.VariantCount),
      };
    });
    setProducts(nextProducts);
    setVariants(nextVariants);
  };

  const loadOrders = async () => {
    const result = await getAdminOrders(adminUserId);
    setOrders(result.data.map((row) => ({
      id:String(row.OrderID), code:String(row.OrderCode), customer:String(row.RecipientName),
      items:Number(row.ItemCount), total:Number(row.TotalAmount), status:String(row.Status),
      createdAt:String(row.CreatedAt),
    })));
  };

  const refreshAll = async () => {
    if (!databaseApiEnabled) return;
    setLoading(true); setError("");
    try {
      const lookupData = await getCatalogLookups();
      setLookups(lookupData);
      await Promise.all([loadProducts(), loadOrders()]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không tải được dữ liệu quản trị.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshAll(); }, 0);
    return () => window.clearTimeout(timer);
    // refreshAll intentionally reloads when the authenticated admin changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminUserId]);

  const selectedProduct = products.find((product) => product.id === selectedProductId) || null;
  const selectedVariants = variants.filter((variant) => variant.productId === selectedProductId);
  const filteredProducts = useMemo(() => products.filter((product) =>
    `${product.name} ${product.primarySku}`.toLowerCase().includes(query.toLowerCase())), [products, query]);

  const runMutation = async (work: () => Promise<void>, success: string) => {
    setSaving(true); setError(""); setMessage("");
    try { await work(); setMessage(success); }
    catch (mutationError) { setError(mutationError instanceof Error ? mutationError.message : "Thao tác thất bại."); }
    finally { setSaving(false); }
  };

  const updateProductDraft = (changes: Partial<AdminProduct>) => {
    if (!selectedProductId) return;
    setProducts((current) => current.map((product) => product.id === selectedProductId ? { ...product, ...changes } : product));
  };

  const saveProduct = (product: AdminProduct) => runMutation(async () => {
    await updateAdminProduct(Number(product.id), {
      adminUserId, categoryId:product.categoryId, name:product.name, description:product.description,
    });
    if (product.price !== product.persistedPrice) {
      await updateAdminProductPrice(Number(product.id), adminUserId, product.price);
    }
    await loadProducts();
  }, "Đã lưu sản phẩm và ghi lịch sử nếu giá thay đổi.");

  const toggleProduct = (product: AdminProduct) => runMutation(async () => {
    await setAdminProductActive(Number(product.id), adminUserId, product.status !== "active");
    await loadProducts();
  }, product.status === "active" ? "Đã ẩn sản phẩm." : "Đã hiển thị sản phẩm.");

  const saveVariant = (variant: AdminVariant) => runMutation(async () => {
    await saveAdminVariant({
      variantId:Number(variant.id), productId:Number(variant.productId), sizeId:variant.sizeId,
      colorId:variant.colorId, sku:variant.sku, stockQuantity:variant.stock,
      isActive:variant.active, adminUserId,
    });
    await loadProducts();
  }, "Đã lưu biến thể và tồn kho.");

  const createVariant = (product: AdminProduct, sizeId: number, colorId: number, sku: string) => runMutation(async () => {
    await saveAdminVariant({ productId:Number(product.id), sizeId, colorId, sku, stockQuantity:0, isActive:true, adminUserId });
    await loadProducts();
  }, "Đã tạo biến thể mới với tồn kho bằng 0.");

  const createProduct = (form: { name:string; categoryId:number; price:number; description:string }) => runMutation(async () => {
    const result = await createAdminProduct({ ...form, adminUserId });
    await loadProducts();
    setShowCreate(false);
    setSelectedProductId(String(result.output.ProductID));
  }, "Đã tạo sản phẩm ở trạng thái đang ẩn.");

  const changeOrderStatus = (order: AdminOrder, nextStatus: "PREPARING" | "SHIPPING" | "COMPLETED") => runMutation(async () => {
    if (nextStatus === "COMPLETED") await completeOrder(Number(order.id), adminUserId, true);
    else await updateOrderStatus(Number(order.id), adminUserId, nextStatus);
    await loadOrders();
  }, "Đã cập nhật trạng thái đơn hàng.");

  const navigate = (next: AdminSection) => { setSection(next); setSelectedProductId(null); setSidebarOpen(false); setMessage(""); setError(""); };

  return <div className="min-h-screen bg-[#F7F2EB] font-['DM_Sans'] text-foreground lg:grid lg:grid-cols-[248px_1fr]">
    {sidebarOpen && <button aria-label="Đóng menu" className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)}/>}
    <aside className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col bg-[#211915] text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}>
      <div className="border-b border-white/10 px-6 py-5"><p className="font-['Playfair_Display'] text-2xl font-bold tracking-widest">DECO</p><p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-white/45">Administration</p></div>
      <nav className="flex-1 space-y-1 p-3">{sections.map(({ id, label, icon:Icon }) => <button key={id} onClick={() => navigate(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${section === id ? "bg-[#C05A2D]" : "text-white/65 hover:bg-white/8"}`}><Icon size={18}/>{label}{section === id && <ChevronRight size={14} className="ml-auto"/>}</button>)}</nav>
      <div className="border-t border-white/10 p-3"><button onClick={onExit} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/65"><ArrowLeft size={17}/>Quay lại cửa hàng</button><button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/65"><LogOut size={17}/>Đăng xuất quản trị</button></div>
    </aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-[#E8DED3] bg-[#F7F2EB]/90 px-4 backdrop-blur-md sm:px-6 lg:px-8"><button onClick={() => setSidebarOpen(true)} className="mr-3 rounded-lg p-2 lg:hidden"><Menu size={20}/></button><div><p className="text-xs text-muted-foreground">DECO Admin</p><h1 className="font-['Playfair_Display'] text-lg font-semibold">{sections.find((item) => item.id === section)?.label}</h1></div><button onClick={() => void refreshAll()} disabled={loading} className="ml-auto flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/>Làm mới</button></header>
      <main className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">
        {!databaseApiEnabled && <Notice tone="warning">API database đang tắt. Tạo file <code>frontend/.env.local</code> với <code>VITE_USE_DATABASE_API=true</code> để chạy localhost.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}{message && <Notice tone="success">{message}</Notice>}
        {loading ? <div className="flex min-h-64 items-center justify-center gap-3 text-muted-foreground"><LoaderCircle className="animate-spin"/>Đang tải dữ liệu từ SQL Server...</div> : <>
          {section === "overview" && <Overview products={products} variants={variants} orders={orders} onNavigate={navigate}/>}
          {section === "products" && !selectedProduct && <ProductList products={filteredProducts} query={query} setQuery={setQuery} onSelect={setSelectedProductId} onCreate={() => setShowCreate(true)}/>}
          {section === "products" && selectedProduct && <ProductEditor product={selectedProduct} variants={selectedVariants} lookups={lookups} saving={saving} onBack={() => setSelectedProductId(null)} onDraft={updateProductDraft} onVariantDraft={(next) => setVariants((current) => current.map((item) => item.id === next.id ? next : item))} onSave={() => void saveProduct(selectedProduct)} onToggle={() => void toggleProduct(selectedProduct)} onSaveVariant={(variant) => void saveVariant(variant)} onCreateVariant={(sizeId,colorId,sku) => void createVariant(selectedProduct,sizeId,colorId,sku)}/>}
          {section === "attributes" && <Attributes lookups={lookups}/>}
          {section === "orders" && <Orders orders={orders} saving={saving} onChange={changeOrderStatus}/>}
          {section === "history" && <ChangeHistory products={products} orders={orders} adminUserId={adminUserId}/>}
        </>}
      </main>
    </div>
    {showCreate && <CreateProductModal lookups={lookups} saving={saving} onClose={() => setShowCreate(false)} onCreate={(form) => void createProduct(form)}/>}
  </div>;
}

function Notice({ tone, children }: { tone:"error"|"success"|"warning"; children:React.ReactNode }) {
  const colors = tone === "error" ? "border-red-200 bg-red-50 text-red-700" : tone === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800";
  return <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${colors}`}>{children}</div>;
}

function Overview({ products, variants, orders, onNavigate }: { products:AdminProduct[]; variants:AdminVariant[]; orders:AdminOrder[]; onNavigate:(section:AdminSection)=>void }) {
  const cards = [
    ["Sản phẩm đang bán", products.filter((item) => item.status === "active").length, PackageCheck],
    ["Đơn chờ xử lý", orders.filter((item) => item.status === "PENDING").length, ShoppingBag],
    ["Biến thể sắp hết", variants.filter((item) => item.active && item.stock <= 3).length, AlertTriangle],
  ] as const;
  return <section><h2 className="font-['Playfair_Display'] text-3xl font-semibold">Tổng quan cửa hàng</h2><p className="mt-2 text-sm text-muted-foreground">Số liệu được đọc trực tiếp từ database DECO.</p><div className="mt-6 grid gap-4 sm:grid-cols-3">{cards.map(([label,value,Icon]) => <div key={label} className="rounded-2xl border bg-white p-5"><Icon className="text-[#C05A2D]"/><p className="mt-4 text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>)}</div><div className="mt-6 rounded-2xl bg-[#2A201B] p-6 text-white"><Sparkles className="text-[#E59A79]"/><h3 className="mt-3 font-['Playfair_Display'] text-xl">Luồng dữ liệu quản trị đã nối API</h3><p className="mt-2 text-sm text-white/60">Products → ProductVariants → Orders → hai bảng lịch sử audit.</p><button onClick={() => onNavigate("products")} className="mt-4 text-sm text-[#E59A79]">Mở quản lý sản phẩm →</button></div></section>;
}

function ProductList({ products, query, setQuery, onSelect, onCreate }: { products:AdminProduct[]; query:string; setQuery:(value:string)=>void; onSelect:(id:string)=>void; onCreate:()=>void }) {
  return <section><div className="mb-6 flex items-end justify-between"><div><p className="text-sm text-muted-foreground">Bao gồm cả sản phẩm đang ẩn</p><h2 className="font-['Playfair_Display'] text-2xl font-semibold">Danh sách sản phẩm</h2></div><button onClick={onCreate} className="flex items-center gap-2 rounded-xl bg-[#C05A2D] px-4 py-2.5 text-sm text-white"><Plus size={17}/>Thêm sản phẩm</button></div><div className="relative mb-4"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc SKU..." className={`${fieldClass} pl-9`}/></div><div className="overflow-hidden rounded-2xl border bg-white">{products.map((product) => <button key={product.id} onClick={() => onSelect(product.id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-4 border-b px-4 py-4 text-left last:border-0 md:grid-cols-[1.7fr_0.7fr_0.5fr_0.5fr_0.5fr]"><div className="flex items-center gap-3"><img src={product.image} className="h-14 w-12 rounded-lg object-cover" alt=""/><div><p className="font-semibold">{product.name}</p><p className="text-xs text-muted-foreground">{product.primarySku} · {product.category}</p></div></div><span className="font-semibold text-[#C05A2D]">{formatCurrency(product.price)}</span><span className="hidden md:block">{product.variantCount} biến thể</span><span className="hidden md:block">{product.totalStock} tồn kho</span><StatusPill active={product.status === "active"}/></button>)}{products.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Không tìm thấy sản phẩm.</p>}</div></section>;
}

function ProductEditor({ product, variants, lookups, saving, onBack, onDraft, onVariantDraft, onSave, onToggle, onSaveVariant, onCreateVariant }: { product:AdminProduct; variants:AdminVariant[]; lookups:CatalogLookups; saving:boolean; onBack:()=>void; onDraft:(changes:Partial<AdminProduct>)=>void; onVariantDraft:(variant:AdminVariant)=>void; onSave:()=>void; onToggle:()=>void; onSaveVariant:(variant:AdminVariant)=>void; onCreateVariant:(sizeId:number,colorId:number,sku:string)=>void }) {
  const [tab,setTab]=useState<"info"|"variants">("info");
  const [sizeId,setSizeId]=useState(lookups.sizes[0]?.id || 0);
  const [colorId,setColorId]=useState(lookups.colors[0]?.id || 0);
  const [sku,setSku]=useState("");
  const categoryChange=(id:number)=>{const category=lookups.categories.find((item)=>item.id===id);onDraft({categoryId:id,category:category?.name||product.category});};
  return <section><button onClick={onBack} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={16}/>Danh sách sản phẩm</button><div className="mb-5 flex items-center justify-between"><div><StatusPill active={product.status === "active"}/><h2 className="mt-2 font-['Playfair_Display'] text-2xl font-semibold">{product.name}</h2><p className="text-sm text-muted-foreground">{product.primarySku} · ID {product.id}</p></div><button disabled={saving} onClick={onToggle} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm">{product.status === "active" ? <EyeOff size={16}/> : <Eye size={16}/>} {product.status === "active" ? "Ẩn sản phẩm" : "Hiển thị"}</button></div><div className="mb-5 flex w-fit gap-1 rounded-xl bg-[#EDE5DA] p-1"><button onClick={()=>setTab("info")} className={`rounded-lg px-4 py-2 text-sm ${tab==="info"?"bg-white shadow":""}`}>Thông tin</button><button onClick={()=>setTab("variants")} className={`rounded-lg px-4 py-2 text-sm ${tab==="variants"?"bg-white shadow":""}`}>Biến thể & tồn kho</button></div>{tab === "info" ? <div className="rounded-2xl border bg-white p-6"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Tên sản phẩm<input value={product.name} onChange={(e)=>onDraft({name:e.target.value})} className={`${fieldClass} mt-1.5`}/></label><label className="text-sm">Danh mục<select value={product.categoryId} onChange={(e)=>categoryChange(Number(e.target.value))} className={`${fieldClass} mt-1.5`}>{lookups.categories.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm">Giá bán<input type="number" min={0} value={product.price} onChange={(e)=>onDraft({price:Math.max(0,Number(e.target.value))})} className={`${fieldClass} mt-1.5`}/><span className="text-xs text-muted-foreground">Đổi giá sẽ kích hoạt trigger lịch sử.</span></label><label className="text-sm">SKU đại diện<input readOnly value={product.primarySku} className={`${fieldClass} mt-1.5 bg-muted`}/></label><label className="text-sm sm:col-span-2">Mô tả<textarea rows={5} value={product.description} onChange={(e)=>onDraft({description:e.target.value})} className={`${fieldClass} mt-1.5`}/></label></div><button disabled={saving||!product.name.trim()} onClick={onSave} className="mt-5 flex items-center gap-2 rounded-xl bg-[#C05A2D] px-5 py-2.5 text-sm text-white disabled:opacity-50"><Save size={16}/>Lưu thay đổi</button></div> : <div className="space-y-5"><div className="rounded-2xl border bg-white p-5"><h3 className="font-semibold">Thêm biến thể</h3><div className="mt-3 flex flex-wrap gap-2"><select value={sizeId} onChange={(e)=>setSizeId(Number(e.target.value))} className={fieldClass}>{lookups.sizes.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={colorId} onChange={(e)=>setColorId(Number(e.target.value))} className={fieldClass}>{lookups.colors.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select><input value={sku} onChange={(e)=>setSku(e.target.value.toUpperCase())} placeholder="SKU duy nhất" className={fieldClass}/><button disabled={saving||!sizeId||!colorId||!sku.trim()} onClick={()=>{onCreateVariant(sizeId,colorId,sku.trim());setSku("");}} className="rounded-xl bg-[#C05A2D] px-4 text-sm text-white"><Plus size={16}/></button></div></div><div className="overflow-hidden rounded-2xl border bg-white">{variants.map((variant)=><div key={variant.id} className={`grid gap-3 border-b p-4 last:border-0 md:grid-cols-[0.5fr_0.8fr_1fr_0.7fr_auto] md:items-center ${variant.active?"":"opacity-50"}`}><span>{variant.size}</span><span className="flex items-center gap-2"><i className="h-4 w-4 rounded-full border" style={{background:variant.colorHex}}/>{variant.color}</span><input value={variant.sku} onChange={(e)=>onVariantDraft({...variant,sku:e.target.value.toUpperCase()})} className={fieldClass}/><input type="number" min={0} value={variant.stock} onChange={(e)=>onVariantDraft({...variant,stock:Math.max(0,Number(e.target.value))})} className={fieldClass}/><div className="flex gap-2"><button disabled={saving} onClick={()=>onSaveVariant(variant)} className="rounded-lg bg-[#C05A2D] p-2 text-white"><Save size={15}/></button><button disabled={saving} onClick={()=>onSaveVariant({...variant,active:!variant.active})} className="rounded-lg border p-2">{variant.active?<EyeOff size={15}/>:<Eye size={15}/>}</button></div></div>)}{variants.length===0&&<p className="p-6 text-center text-sm text-muted-foreground">Chưa có biến thể.</p>}</div></div>}</section>;
}

function Attributes({ lookups }: { lookups:CatalogLookups }) {
  return <section><h2 className="font-['Playfair_Display'] text-2xl font-semibold">Danh mục dùng chung</h2><p className="mt-1 text-sm text-muted-foreground">Màn hình này đọc trực tiếp Categories, Sizes và Colors; CRUD lookup chưa nằm trong phạm vi hiện tại.</p><div className="mt-6 grid gap-6 xl:grid-cols-3"><LookupCard title="Categories" icon={Tags} items={lookups.categories}/><LookupCard title="Sizes" icon={Package} items={lookups.sizes}/><LookupCard title="Colors" icon={Palette} items={lookups.colors}/></div></section>;
}

function LookupCard({ title, icon:Icon, items }: { title:string; icon:typeof Tags; items:CatalogLookups["categories"] }) {
  return <div className="rounded-2xl border bg-white p-5"><div className="flex items-center gap-3"><Icon className="text-[#C05A2D]"/><h3 className="font-semibold">{title}</h3></div><div className="mt-4 space-y-2">{items.map((item)=><div key={item.id} className="flex items-center gap-2 rounded-xl border p-3 text-sm">{item.hexCode&&<i className="h-5 w-5 rounded-full border" style={{background:item.hexCode}}/>}<span>{item.name}</span><code className="ml-auto text-xs text-muted-foreground">#{item.id}</code></div>)}</div></div>;
}

function Orders({ orders, saving, onChange }: { orders:AdminOrder[]; saving:boolean; onChange:(order:AdminOrder,status:"PREPARING"|"SHIPPING"|"COMPLETED")=>void }) {
  const nextStatus=(status:string)=>status==="PENDING"?"PREPARING":status==="PREPARING"?"SHIPPING":status==="SHIPPING"?"COMPLETED":null;
  return <section><h2 className="font-['Playfair_Display'] text-2xl font-semibold">Quản lý đơn hàng</h2><p className="mt-1 text-sm text-muted-foreground">Chỉ cho phép chuyển trạng thái đúng thứ tự nghiệp vụ.</p><div className="mt-5 overflow-hidden rounded-2xl border bg-white">{orders.map((order)=>{const next=nextStatus(order.status);return <div key={order.id} className="grid gap-3 border-b p-4 last:border-0 md:grid-cols-[0.8fr_1fr_0.5fr_0.8fr_0.8fr_auto] md:items-center"><code>{order.code}</code><span>{order.customer}</span><span>{order.items} SP</span><b>{formatCurrency(order.total)}</b><span>{statusLabels[order.status]}</span>{next?<button disabled={saving} onClick={()=>onChange(order,next)} className="rounded-xl bg-[#C05A2D] px-3 py-2 text-xs text-white">→ {statusLabels[next]}</button>:<span className="text-xs text-muted-foreground">Đã kết thúc</span>}</div>})}{orders.length===0&&<p className="p-8 text-center text-sm text-muted-foreground">Chưa có đơn hàng.</p>}</div></section>;
}

function ChangeHistory({ products, orders, adminUserId }: { products:AdminProduct[]; orders:AdminOrder[]; adminUserId:number }) {
  const [tab,setTab]=useState<"price"|"order">("price");
  const [prices,setPrices]=useState<PriceHistoryRow[]>([]);
  const [statuses,setStatuses]=useState<OrderStatusHistoryRow[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{let active=true;Promise.all([
    Promise.all(products.map((item)=>getProductPriceHistory(Number(item.id)))).then((results)=>results.flatMap((result)=>result.data)),
    Promise.all(orders.map((item)=>getOrderStatusHistory(Number(item.id),adminUserId))).then((results)=>results.flatMap((result)=>result.data)),
  ]).then(([priceRows,statusRows])=>{if(active){setPrices(priceRows.sort((a,b)=>Date.parse(b.ChangedAt)-Date.parse(a.ChangedAt)));setStatuses(statusRows.sort((a,b)=>Date.parse(b.ChangedAt)-Date.parse(a.ChangedAt)));}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[products,orders,adminUserId]);
  if(loading)return <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="animate-spin"/>Đang tải lịch sử audit...</div>;
  return <section><h2 className="font-['Playfair_Display'] text-2xl font-semibold">Lịch sử thay đổi</h2><div className="my-4 flex w-fit gap-1 rounded-xl bg-[#EDE5DA] p-1"><button onClick={()=>setTab("price")} className={`rounded-lg px-4 py-2 text-sm ${tab==="price"?"bg-white":""}`}>Giá sản phẩm</button><button onClick={()=>setTab("order")} className={`rounded-lg px-4 py-2 text-sm ${tab==="order"?"bg-white":""}`}>Trạng thái đơn</button></div><div className="overflow-hidden rounded-2xl border bg-white">{tab==="price"?prices.map((row)=><div key={row.PriceHistoryID} className="grid gap-2 border-b p-4 last:border-0 sm:grid-cols-[1.4fr_0.7fr_0.7fr_1fr]"><b>{row.ProductName}</b><span className="line-through">{formatCurrency(Number(row.OldPrice))}</span><span className="text-[#C05A2D]">{formatCurrency(Number(row.NewPrice))}</span><small>{row.ChangedByName||"Hệ thống"}<br/>{new Date(row.ChangedAt).toLocaleString("vi-VN")}</small></div>):statuses.map((row)=><div key={row.StatusHistoryID} className="grid gap-2 border-b p-4 last:border-0 sm:grid-cols-[0.8fr_1.4fr_1fr]"><code>{row.OrderCode}</code><span>{row.OldStatus?statusLabels[row.OldStatus]:"Tạo đơn"} → {statusLabels[row.NewStatus]}</span><small>{row.ChangedByName||"Hệ thống"}<br/>{new Date(row.ChangedAt).toLocaleString("vi-VN")}</small></div>)}{((tab==="price"&&!prices.length)||(tab==="order"&&!statuses.length))&&<p className="p-8 text-center text-sm text-muted-foreground">Chưa có dữ liệu lịch sử.</p>}</div></section>;
}

function CreateProductModal({ lookups, saving, onClose, onCreate }: { lookups:CatalogLookups; saving:boolean; onClose:()=>void; onCreate:(form:{name:string;categoryId:number;price:number;description:string})=>void }) {
  const [name,setName]=useState("");const [description,setDescription]=useState("");const [price,setPrice]=useState(0);const [categoryId,setCategoryId]=useState(lookups.categories[0]?.id||0);
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4"><div className="w-full max-w-lg rounded-2xl bg-[#F7F2EB] p-6"><div className="flex justify-between"><h3 className="font-['Playfair_Display'] text-xl font-semibold">Tạo sản phẩm mới</h3><button onClick={onClose}><X/></button></div><div className="mt-5 space-y-4"><label className="block text-sm">Tên<input autoFocus value={name} onChange={(e)=>setName(e.target.value)} className={`${fieldClass} mt-1.5`}/></label><label className="block text-sm">Danh mục<select value={categoryId} onChange={(e)=>setCategoryId(Number(e.target.value))} className={`${fieldClass} mt-1.5`}>{lookups.categories.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block text-sm">Giá ban đầu<input type="number" min={0} value={price} onChange={(e)=>setPrice(Math.max(0,Number(e.target.value)))} className={`${fieldClass} mt-1.5`}/></label><label className="block text-sm">Mô tả<textarea rows={3} value={description} onChange={(e)=>setDescription(e.target.value)} className={`${fieldClass} mt-1.5`}/></label><p className="rounded-xl bg-white p-3 text-xs text-muted-foreground">Sản phẩm được tạo với IsActive = 0. Hãy thêm biến thể trước khi hiển thị.</p></div><div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-xl border px-4 py-2">Hủy</button><button disabled={saving||!name.trim()||!categoryId} onClick={()=>onCreate({name:name.trim(),categoryId,price,description})} className="rounded-xl bg-[#C05A2D] px-4 py-2 text-white disabled:opacity-50">Tạo sản phẩm</button></div></div></div>;
}

function StatusPill({ active }: { active:boolean }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${active?"bg-green-50 text-green-700":"bg-gray-100 text-gray-500"}`}>{active?"Đang bán":"Đang ẩn"}</span>;
}
