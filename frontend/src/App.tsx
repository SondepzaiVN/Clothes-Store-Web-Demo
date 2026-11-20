import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CreditCard,
  Heart,
  MapPin,
  MessageCircle,
  Minus,
  LoaderCircle,
  Package,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  TicketPercent,
  Trash2,
} from "lucide-react";
import { AuthModal } from "./components/auth/AuthModal";
import { BottomNavigation } from "./components/layout/BottomNavigation";
import { Header } from "./components/layout/Header";
import { CategoryBadge as CatBadge } from "./components/products/CategoryBadge";
import { ProductCard } from "./components/products/ProductCard";
import { RatingRow as StarRow } from "./components/products/RatingRow";
import {
  BASE_PRODUCTS,
  CATEGORIES,
  createSupportConversation,
  DEMO_BUYER_CONVERSATIONS,
  DEMO_BUYER_ORDERS,
  DEMO_CUSTOMER,
  DECO_SUPPORT_ID,
  INITIAL_BUYER_CONVERSATIONS,
  INITIAL_BUYER_ORDERS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  VOUCHERS,
} from "./data/mockData";
import type {
  AppUser,
  AuthForm,
  AuthMode,
  AuthStep,
  BuyerConversation as BuyerConvo,
  BuyerMessage as BuyerMsg,
  CartItem,
  CheckoutStep,
  Order,
  OrderStatus,
  Product,
  View,
} from "./types";
import {
  discountPercent as pct,
  formatCurrency as fmt,
  normalizeText,
} from "./utils/format";
import {
  cancelOrder as cancelDatabaseOrder,
  createOrder as createDatabaseOrder,
  databaseApiEnabled,
  getOrderDetail,
  getUserOrders,
  loadProductsFromDatabase,
  semanticSearchProducts,
  simulatePaymentWebhook,
  type ParsedSemanticSearch,
} from "./services/decoApi";
import { clearSession, readSession, writeSession } from "./services/session";

const cloneProducts = () => BASE_PRODUCTS.map((product) => ({
  ...product,
  variants: product.variants.map((variant) => ({ ...variant })),
}));

export default function App() {
  const navigate = useNavigate();
  const [view, setView]           = useState<View>("home");
  const [selProd, setSelProd]     = useState<Product | null>(null);
  const [cart, setCart]           = useState<CartItem[]>([]);
  const [user, setUser]           = useState<AppUser | null>(readSession);
  const [showAuth, setShowAuth]   = useState(false);
  const [authMode, setAuthMode]   = useState<AuthMode>("login");
  const [authStep, setAuthStep]   = useState<AuthStep>("credentials");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authForm, setAuthForm]   = useState<AuthForm>({ name:"", email:"", phone:"", password:"", confirmPassword:"", otp:"" });
  const [pendingAction, setPendingAction] = useState<"checkout" | "messages" | null>(null);
  const [registeredAccount, setRegisteredAccount] = useState<{ name: string; email: string } | null>(null);
  const [searchQ, setSearchQ]     = useState("");
  const [searchIn, setSearchIn]   = useState("");
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [searchMeta, setSearchMeta] = useState<ParsedSemanticSearch | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [liked, setLiked]         = useState<string[]>([]);
  const [buyConvos, setBuyConvos] = useState<BuyerConvo[]>(INITIAL_BUYER_CONVERSATIONS);
  const [activeBC, setActiveBC]   = useState<string | null>(null);
  const [msgIn, setMsgIn]         = useState("");
  const [selSize, setSelSize]     = useState("");
  const [selColor, setSelColor]   = useState("");
  const [checkout, setCheckout]   = useState<CheckoutStep>("bag");
  const [category, setCategory]   = useState("Tất cả");
  const [payForm, setPayForm]     = useState({ name:"", phone:"", address:"", method:"cod", voucher:"BEST10", note:"" });
  const [payError, setPayError]   = useState("");
  const [savedAddress, setSavedAddress] = useState({ name:"", phone:"", address:"" });
  const [buyerOrders, setBuyerOrders] = useState<Order[]>(INITIAL_BUYER_ORDERS);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderNotice, setOrderNotice] = useState("");
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>(cloneProducts);

  const msgEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { msgEnd.current?.scrollIntoView({ behavior:"smooth" }); }, [activeBC, buyConvos]);
  useEffect(() => { window.scrollTo({ top:0, behavior:"auto" }); }, [view]);
  useEffect(() => { if (user?.role === "ADMIN") navigate("/admin", { replace:true }); }, [navigate, user]);
  useEffect(() => {
    if (!databaseApiEnabled) return;
    let active = true;
    loadProductsFromDatabase()
      .then((databaseProducts) => {
        if (active && databaseProducts.length > 0) setProducts(databaseProducts);
      })
      .catch((error) => console.warn("Không thể tải catalog từ DECO API; tiếp tục dùng mock data.", error));
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!databaseApiEnabled || user?.role !== "CUSTOMER") return;
    getUserOrders(user.databaseUserId).then(async ({ data }) => {
      const details = await Promise.all(data.map((row) => getOrderDetail(Number(row.OrderID), user.databaseUserId)));
      const mapped: Order[] = details.map(({ order, items, payments }) => ({
        id:String(order.OrderID), code:String(order.OrderCode), customer:String(order.RecipientName), phone:String(order.RecipientPhone), address:String(order.ShippingAddress),
        items:items.map((item) => { const variantId=String(item.ProductVariantID); const product=products.find((candidate)=>candidate.variants.some((variant)=>variant.id===variantId)); return { productId:product?.id||"", variantId, name:String(item.ProductNameSnapshot), size:String(item.SizeNameSnapshot), color:String(item.ColorNameSnapshot), qty:Number(item.Quantity), price:Number(item.UnitPrice) }; }),
        subtotal:Number(order.Subtotal), shippingFee:Number(order.ShippingFee), discount:Number(order.DiscountAmount), voucherCode:order.VoucherCode ? String(order.VoucherCode) : undefined,
        total:Number(order.TotalAmount), date:new Date(String(order.CreatedAt)).toLocaleDateString("vi-VN"), status:String(order.Status).toLowerCase() as OrderStatus,
        paymentMethod:String(payments[0]?.PaymentMethod||"COD").toLowerCase() as Order["paymentMethod"], paymentStatus:String(payments[0]?.PaymentStatus||"PENDING").toLowerCase() as Order["paymentStatus"],
        transactionRef:payments[0]?.TransactionRef ? String(payments[0].TransactionRef) : undefined, note:order.Note ? String(order.Note) : undefined,
      }));
      setBuyerOrders(mapped);
    }).catch((error)=>console.warn("Không thể tải đơn hàng từ DECO API.",error));
  }, [user, products]);

  const allProducts = products.filter((product) => product.isActive);
  const cartCount    = cart.reduce((a, c) => a + c.quantity, 0);
  const selectedCart = cart.filter((item) => item.selected);
  const selectedCount = selectedCart.reduce((a, c) => a + c.quantity, 0);
  const cartTotal    = selectedCart.reduce((a, c) => a + c.product.price * c.quantity, 0);
  const selectedVoucher = VOUCHERS.find((voucher) => voucher.code === payForm.voucher) || VOUCHERS.find((voucher) => voucher.code === "NONE")!;
  const voucherDiscount = selectedVoucher.discount(cartTotal);
  const shippingFee = cartTotal > 0 ? 30000 : 0;
  const checkoutTotal = Math.max(0, cartTotal + shippingFee - voucherDiscount);
  const totalUnread  = user ? buyConvos.reduce((a, c) => a + c.unread, 0) : 0;
  const filtered     = allProducts.filter((p) => category === "Tất cả" || p.category === category);
  const recommended  = allProducts.filter((p) => liked.some((id) => { const lp = allProducts.find((x) => x.id === id); return lp && (lp.category === p.category || lp.shopId === p.shopId) && p.id !== id; })).slice(0, 4);
  const getVariantStock = (product: Product, size: string, color: string) => {
    const currentProduct = products.find((item) => item.id === product.id) ?? product;
    return currentProduct.variants.find((variant) => variant.size === size && variant.color === color && variant.isActive)?.stock ?? 0;
  };
  const isVoucherAvailable = (voucherCode: string) => {
    const voucher = VOUCHERS.find((item) => item.code === voucherCode);
    return Boolean(voucher?.isActive && cartTotal >= voucher.minimumOrder);
  };

  const runSearch = async () => {
    const query = searchIn.trim();
    if (!query) return;

    setSearchQ(query);
    setCategory("Tất cả");
    setView("search");
    setSearchError("");
    setSearchMeta(null);

    const normalizedQuery = normalizeText(query);
    const fallback = allProducts.filter((product) =>
      normalizeText(`${product.name} ${product.description}`).includes(normalizedQuery),
    );

    if (!databaseApiEnabled) {
      setSearchResults(fallback);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await semanticSearchProducts(query, 1, 100);
      const productsById = new Map(allProducts.map((product) => [product.id, product]));
      setSearchResults(response.data
        .map((row) => productsById.get(String(row.ProductID)))
        .filter((product): product is Product => Boolean(product)));
      setSearchMeta(response.parsed);
    } catch (error) {
      setSearchResults(fallback);
      setSearchError(error instanceof Error
        ? `${error.message} Đang hiển thị kết quả tìm kiếm từ khóa.`
        : "AI search tạm thời không khả dụng. Đang hiển thị kết quả từ khóa.");
    } finally {
      setSearchLoading(false);
    }
  };

  const toggleLike   = (id: string) => setLiked((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const openProduct  = (p: Product) => { setSelProd(p); setSelSize(""); setSelColor(""); setView("product"); };
  const ensureSupportConversation = () => setBuyConvos((prev) => prev.some((c) => c.shopId === DECO_SUPPORT_ID) ? prev : [createSupportConversation()]);
  const openConvo = () => {
    if (!user) { setPendingAction("messages"); setShowAuth(true); return; }
    ensureSupportConversation();
    setBuyConvos((prev) => prev.map((c) => c.shopId === DECO_SUPPORT_ID ? { ...c, unread:0 } : c));
    setActiveBC(DECO_SUPPORT_ID); setView("messages");
  };
  const openMessages = () => { if (!user) { setPendingAction("messages"); setShowAuth(true); return; } ensureSupportConversation(); setActiveBC(DECO_SUPPORT_ID); setView("messages"); };
  const addToCart    = () => {
    if (!selProd || !selSize || !selColor) return;
    const stock = getVariantStock(selProd, selSize, selColor);
    if (stock <= 0) return;
    setCart((prev) => { const ex = prev.find((i) => i.product.id === selProd.id && i.size === selSize && i.color === selColor); return ex ? prev.map((i) => i === ex ? { ...i, quantity: Math.min(stock, i.quantity + 1), selected:true } : i) : [...prev, { product: selProd, quantity:1, size: selSize, color:selColor, selected:true }]; });
    setView("cart"); setCheckout("bag");
  };
  const updateQty    = (idx: number, d: number) => setCart((prev) => prev.map((item, i) => i === idx ? { ...item, quantity: Math.min(getVariantStock(item.product, item.size, item.color), Math.max(1, item.quantity + d)) } : item));
  const removeItem   = (idx: number) => setCart((prev) => prev.filter((_, i) => i !== idx));
  const toggleCartSelection = (idx: number) => setCart((prev) => prev.map((item, i) => i === idx ? { ...item, selected:!item.selected } : item));
  const sendMsg      = () => {
    if (!msgIn.trim() || !activeBC) return;
    const t = new Date().toLocaleTimeString("vi-VN", { hour:"2-digit", minute:"2-digit" });
    setBuyConvos((prev) => prev.map((c) => c.shopId === activeBC ? { ...c, messages:[...c.messages, { id: Date.now().toString(), from:"user", text: msgIn.trim(), time: t }] } : c));
    setMsgIn("");
    setTimeout(() => { const r: BuyerMsg = { id:(Date.now()+1).toString(), from:"admin", text:"Cảm ơn bạn! Bộ phận hỗ trợ DECO sẽ phản hồi sớm nhất.", time: new Date().toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}) }; setBuyConvos((prev) => prev.map((c) => c.shopId === activeBC ? { ...c, messages:[...c.messages, r] } : c)); }, 1000);
  };
  const prepareCheckout = () => {
    const availableVouchers = VOUCHERS.filter((voucher) => voucher.isActive && cartTotal >= voucher.minimumOrder);
    const bestVoucher = availableVouchers.reduce((best, current) => current.discount(cartTotal) > best.discount(cartTotal) ? current : best, VOUCHERS.find((voucher) => voucher.code === "NONE")!);
    setPayForm((prev) => ({ ...prev, name:prev.name || savedAddress.name, phone:prev.phone || savedAddress.phone, address:prev.address || savedAddress.address, voucher:bestVoucher.code }));
    setPayError(""); setCheckout("payment"); setView("cart");
  };

  const beginCheckout = () => {
    if (selectedCart.length === 0) return;
    if (!user) { setPendingAction("checkout"); setShowAuth(true); return; }
    prepareCheckout();
  };

  const submitAuthCredentials = () => {
    setAuthError(""); setAuthNotice("");
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authForm.email);
    if (authMode === "register" && !authForm.name.trim()) return setAuthError("Vui lòng nhập họ và tên.");
    if (!emailValid) return setAuthError("Email không đúng định dạng.");
    if (authMode === "register" && !/^0\d{9}$/.test(authForm.phone)) return setAuthError("Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.");
    if (authForm.password.length < 6) return setAuthError("Mật khẩu phải có ít nhất 6 ký tự.");
    if (authMode === "login" && authForm.email.trim().toLowerCase() === "admin@deco.vn" && authForm.password !== "Admin@123") return setAuthError("Email hoặc mật khẩu không chính xác.");
    if (authMode === "register" && authForm.password !== authForm.confirmPassword) return setAuthError("Hai mật khẩu không trùng nhau.");
    setAuthStep("otp"); setAuthNotice("Mã OTP đã được gửi đến email của bạn.");
  };

  const verifyOtp = () => {
    if (authForm.otp !== "123456") { setAuthError("OTP không đúng hoặc đã hết hạn."); return; }
    if (authMode === "register") {
      setRegisteredAccount({ name:authForm.name.trim(), email:authForm.email.trim() });
      setBuyerOrders([]); setBuyConvos([]); setActiveBC(null);
      setSavedAddress({ name:"", phone:"", address:"" });
      setSelectedOrderId(null); setLastOrder(null);
      setAuthMode("login"); setAuthStep("credentials"); setAuthNotice("Tạo tài khoản thành công. Vui lòng đăng nhập."); setAuthError("");
      setAuthForm((prev) => ({ ...prev, name:"", phone:"", password:"", confirmPassword:"", otp:"" })); return;
    }
    const loginEmail = authForm.email.trim();
    const isAdmin = loginEmail.toLowerCase() === "admin@deco.vn";
    const isDemoCustomer = loginEmail.toLowerCase() === DEMO_CUSTOMER.email;
    const displayName = isDemoCustomer
      ? DEMO_CUSTOMER.name
      : registeredAccount?.email.toLowerCase() === loginEmail.toLowerCase()
      ? registeredAccount.name
      : loginEmail.split("@")[0] || "Người dùng";
    const sessionUser: AppUser = {
      id:isAdmin ? "admin-1" : isDemoCustomer ? DEMO_CUSTOMER.id : "u1",
      databaseUserId:isAdmin ? 1 : 2,
      name:isAdmin ? "Admin DECO" : displayName,
      email:loginEmail,
      role:isAdmin ? "ADMIN" : "CUSTOMER",
    };
    setUser(sessionUser);
    writeSession(sessionUser);
    setProducts(cloneProducts());
    setBuyerOrders(isDemoCustomer ? DEMO_BUYER_ORDERS.map((order) => ({ ...order, items:order.items.map((item) => ({ ...item })) })) : []);
    setBuyConvos(isDemoCustomer ? DEMO_BUYER_CONVERSATIONS.map((conversation) => ({ ...conversation, messages:conversation.messages.map((message) => ({ ...message })) })) : []);
    setSavedAddress(isDemoCustomer ? { name:DEMO_CUSTOMER.name, phone:DEMO_CUSTOMER.phone, address:DEMO_CUSTOMER.address } : { name:"", phone:"", address:"" });
    setShowAuth(false); setAuthStep("credentials"); setAuthError(""); setAuthNotice("");
    setAuthForm({ name:"", email:"", phone:"", password:"", confirmPassword:"", otp:"" });
    if (pendingAction === "checkout") prepareCheckout();
    if (pendingAction === "messages") {
      ensureSupportConversation(); setActiveBC(DECO_SUPPORT_ID); setView("messages");
    }
    setPendingAction(null);
    if (isAdmin) navigate("/admin", { replace:true });
  };

  const placeOrder = async () => {
    setPayError("");
    const normalizedPhone = payForm.phone.replace(/\D/g, "");
    if (!payForm.name.trim() || !/^0\d{9}$/.test(normalizedPhone) || !payForm.address.trim()) {
      setPayError("Vui lòng nhập đầy đủ họ tên, số điện thoại hợp lệ và địa chỉ giao hàng."); return;
    }
    const unavailableItem = selectedCart.find((item) => item.quantity > getVariantStock(item.product, item.size, item.color));
    if (unavailableItem) {
      setPayError(`${unavailableItem.product.name} (${unavailableItem.size}, ${unavailableItem.color}) không còn đủ số lượng trong kho.`); return;
    }
    if (!isVoucherAvailable(payForm.voucher)) {
      setPayError("Voucher không còn hiệu lực hoặc đơn hàng chưa đạt giá trị tối thiểu."); return;
    }
    const paymentMethod = payForm.method === "transfer" ? "bank" : payForm.method === "momo" ? "wallet" : "cod";
    let databaseOrder: { OrderID: number; OrderCode: string } | null = null;
    if (databaseApiEnabled && user) {
      try {
        const created = await createDatabaseOrder({ userId:user.databaseUserId, recipientName:payForm.name.trim(), recipientPhone:normalizedPhone, shippingAddress:payForm.address.trim(), voucherCode:selectedVoucher.code === "NONE" ? undefined : selectedVoucher.code, paymentMethod:paymentMethod.toUpperCase() as "COD"|"BANK"|"WALLET", note:payForm.note, items:selectedCart.map((item)=>({ productVariantId:Number((products.find((p)=>p.id===item.product.id)||item.product).variants.find((v)=>v.size===item.size&&v.color===item.color)!.id), quantity:item.quantity })) });
        databaseOrder = created.output;
        const detail = await getOrderDetail(created.output.OrderID, user.databaseUserId);
        const paymentId = Number(detail.payments[0]?.PaymentID || 0);
        if (paymentMethod !== "cod" && paymentId) await simulatePaymentWebhook(paymentId, "PAID");
      } catch (error) { setPayError(error instanceof Error ? error.message : "Không thể tạo đơn hàng."); return; }
    }
    const nextOrderNumber = Math.max(0, ...buyerOrders.map((item) => Number(item.id.match(/\d+$/)?.[0] ?? 0))) + 1;
    const order: Order = {
      id:databaseOrder ? String(databaseOrder.OrderID) : `DECO-${String(nextOrderNumber).padStart(6, "0")}`, code:databaseOrder?.OrderCode, customer:payForm.name, phone:normalizedPhone, address:payForm.address,
      items:selectedCart.map((item) => {
        const currentProduct = products.find((product) => product.id === item.product.id) ?? item.product;
        const variant = currentProduct.variants.find((candidate) => candidate.size === item.size && candidate.color === item.color)!;
        return { productId:currentProduct.id, variantId:variant.id, name:currentProduct.name, size:item.size, color:item.color, qty:item.quantity, price:currentProduct.price };
      }),
      subtotal:cartTotal, shippingFee, discount:voucherDiscount, voucherCode:selectedVoucher.code === "NONE" ? undefined : selectedVoucher.code,
      total:checkoutTotal, date:new Date().toLocaleDateString("vi-VN"), status:"pending", paymentMethod,
      paymentStatus:paymentMethod === "cod" ? "pending" : "paid", note:payForm.note, trackingUpdated:"Vừa xong",
      transactionRef:paymentMethod === "cod" ? undefined : `DEMO-${paymentMethod.toUpperCase()}-${String(nextOrderNumber).padStart(6, "0")}`,
    };
    setProducts((current) => current.map((product) => {
      const orderedItems = selectedCart.filter((item) => item.product.id === product.id);
      if (orderedItems.length === 0) return product;
      return {
        ...product,
        variants:product.variants.map((variant) => {
          const orderedItem = orderedItems.find((item) => item.size === variant.size && item.color === variant.color);
          return orderedItem ? { ...variant, stock:variant.stock - orderedItem.quantity } : variant;
        }),
      };
    }));
    setBuyerOrders((prev) => [order, ...prev]); setLastOrder(order); setSavedAddress({ name:payForm.name, phone:payForm.phone, address:payForm.address });
    setCart((prev) => prev.filter((item) => !item.selected)); setCheckout("success");
  };

  const cancelOrder = async (order: Order) => {
    if (order.status !== "pending" || order.paymentStatus === "paid") return;
    if (databaseApiEnabled && user) {
      try { await cancelDatabaseOrder(Number(order.id), user.databaseUserId, "Khách hàng hủy đơn"); }
      catch (error) { setOrderNotice(error instanceof Error ? error.message : "Không thể hủy đơn."); return; }
    }
    setProducts((current) => current.map((product) => ({
      ...product,
      variants:product.variants.map((variant) => {
        const returnedItem = order.items.find((item) => item.productId === product.id && item.variantId === variant.id);
        return returnedItem ? { ...variant, stock:variant.stock + returnedItem.qty } : variant;
      }),
    })));
    setBuyerOrders((current) => current.map((item) => item.id === order.id
      ? { ...item, status:"cancelled", paymentStatus:item.paymentStatus === "pending" ? "cancelled" : item.paymentStatus, trackingUpdated:"Vừa xong" }
      : item));
    setOrderNotice("Đã hủy đơn, hoàn lại tồn kho và hủy Payment đang chờ.");
  };

  const curBC = buyConvos.find((c) => c.shopId === activeBC);

  return (
    <div className="min-h-screen bg-background font-['DM_Sans']">

      <AuthModal
        open={showAuth}
        mode={authMode}
        step={authStep}
        form={authForm}
        error={authError}
        notice={authNotice}
        onClose={() => {
          setShowAuth(false);
          setAuthStep("credentials");
          setAuthError("");
          setAuthNotice("");
          setPendingAction(null);
        }}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthError("");
          setAuthNotice("");
        }}
        onFormChange={setAuthForm}
        onBack={() => {
          setAuthStep("credentials");
          setAuthError("");
        }}
        onSubmitCredentials={submitAuthCredentials}
        onVerifyOtp={verifyOtp}
      />

      <Header
        user={user}
        searchValue={searchIn}
        cartCount={cartCount}
        unreadCount={totalUnread}
        onSearchChange={setSearchIn}
        onSearch={runSearch}
        onHome={() => setView("home")}
        onMessages={openMessages}
        onCart={() => {
          setView("cart");
          setCheckout("bag");
        }}
        onOrders={() => {
          setSelectedOrderId(null);
          setView("orders");
        }}
        onLogin={() => setShowAuth(true)}
        onLogout={() => { clearSession(); setUser(null); }}
      />

      <main className="pb-16">

        {/* ── Home ── */}
        {view === "home" && (
          <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="relative rounded-2xl overflow-hidden mb-8 h-52 sm:h-72 bg-secondary">
              <img src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1200&h=500&fit=crop&auto=format" alt="banner" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent flex items-center">
                <div className="px-8 sm:px-12">
                  <p className="text-white/70 text-sm font-medium tracking-widest uppercase mb-2">Bộ sưu tập mới</p>
                  <h1 className="font-['Playfair_Display'] text-3xl sm:text-5xl font-bold text-white leading-tight mb-4">Thời trang<br />Thuần Việt</h1>
                  <button onClick={() => setCategory("Tất cả")} className="flex items-center gap-2 px-5 py-2.5 bg-white text-foreground text-sm font-medium rounded-full hover:bg-white/90 transition-colors">Khám phá ngay <ChevronRight size={14} /></button>
                </div>
              </div>
            </div>
            {recommended.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-4"><Sparkles size={16} className="text-[#C05A2D]" /><h2 className="font-['Playfair_Display'] text-lg font-semibold">Đề xuất cho bạn</h2></div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {recommended.map((p) => <ProductCard key={p.id} product={p} liked={liked.includes(p.id)} onLike={toggleLike} onClick={openProduct} />)}
                </div>
              </section>
            )}
            <div className="flex gap-2 overflow-x-auto pb-3 mb-5">
              {CATEGORIES.map((cat) => <CatBadge key={cat} label={cat} active={category === cat} onClick={() => setCategory(cat)} />)}
            </div>
            {filtered.length === 0
              ? <div className="text-center py-16 text-muted-foreground"><Package size={40} className="mx-auto mb-3 opacity-40" /><p>Không có sản phẩm nào</p></div>
              : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{filtered.map((p) => <ProductCard key={p.id} product={p} liked={liked.includes(p.id)} onLike={toggleLike} onClick={openProduct} />)}</div>}
          </div>
        )}

        {/* ── Search ── */}
        {view === "search" && (() => {
          const normalizedQuery = normalizeText(searchQ);
          const res = searchResults ?? (normalizedQuery
            ? allProducts.filter((p) => normalizeText(`${p.name} ${p.description}`).includes(normalizedQuery))
            : []);
          const filterChips = searchMeta ? [
            searchMeta.categoryName,
            searchMeta.colorName,
            searchMeta.sizeName ? `Size ${searchMeta.sizeName}` : null,
            searchMeta.minPrice !== null ? `Từ ${fmt(searchMeta.minPrice)}` : null,
            searchMeta.maxPrice !== null ? `Tối đa ${fmt(searchMeta.maxPrice)}` : null,
            searchMeta.inStock ? "Còn hàng" : null,
          ].filter((chip): chip is string => Boolean(chip)) : [];
          return (
            <div className="max-w-6xl mx-auto px-4 py-6">
              <div className="flex items-center gap-3 mb-5">
                <button onClick={() => setView("home")} className="p-1.5 hover:bg-secondary rounded-full transition-colors"><ArrowLeft size={18} /></button>
                <div><h2 className="font-['Playfair_Display'] text-lg font-semibold">{searchQ ? `Kết quả cho "${searchQ}"` : "Tìm kiếm sản phẩm"}</h2><p className="text-xs text-muted-foreground mt-0.5">{searchMeta ? "AI hiểu ngữ nghĩa · SQL lọc dữ liệu chính xác" : "Tìm theo tên hoặc mô tả sản phẩm"}</p></div>
                <span className="text-sm text-muted-foreground ml-auto">{res.length} sản phẩm</span>
              </div>
              {filterChips.length > 0 && <div className="mb-5 flex flex-wrap items-center gap-2"><span className="flex items-center gap-1 text-xs font-medium text-[#C05A2D]"><Sparkles size={13}/>AI đã hiểu:</span>{filterChips.map((chip) => <span key={chip} className="rounded-full bg-[#C05A2D]/10 px-2.5 py-1 text-xs text-[#9A4825]">{chip}</span>)}</div>}
              {searchError && <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{searchError}</p>}
              {searchLoading
                ? <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground"><LoaderCircle size={22} className="animate-spin"/><span>AI đang phân tích yêu cầu...</span></div>
                : res.length === 0
                ? <div className="text-center py-20 text-muted-foreground"><Search size={40} className="mx-auto mb-3 opacity-30" /><p className="font-medium">{searchQ ? "Không tìm thấy sản phẩm phù hợp" : "Nhập từ khóa trên thanh tìm kiếm"}</p>{searchQ && <p className="text-sm mt-1">Hãy thử từ khóa ngắn hoặc tên sản phẩm khác.</p>}</div>
                : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{res.map((p) => <ProductCard key={p.id} product={p} liked={liked.includes(p.id)} onLike={toggleLike} onClick={openProduct} />)}</div>}
            </div>
          );
        })()}

        {/* ── Product Detail ── */}
        {view === "product" && selProd && (() => {
          const p = selProd;
          const selectedVariant = p.variants.find((variant) => variant.size === selSize && variant.color === selColor && variant.isActive);
          const canAdd = Boolean(selectedVariant && selectedVariant.stock > 0);
          return (
            <div className="max-w-5xl mx-auto px-4 py-6">
              <button onClick={() => setView("home")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"><ArrowLeft size={15} /> Tiếp tục mua sắm</button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="relative rounded-2xl overflow-hidden bg-secondary aspect-[3/4]">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  <button onClick={() => toggleLike(p.id)} className="absolute top-4 right-4 w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-sm">
                    <Heart size={18} className={liked.includes(p.id) ? "fill-[#C05A2D] text-[#C05A2D]" : "text-muted-foreground"} />
                  </button>
                  {p.originalPrice && <span className="absolute top-4 left-4 bg-[#C05A2D] text-white text-xs font-semibold px-3 py-1 rounded-full">-{pct(p.originalPrice, p.price)}%</span>}
                </div>
                <div>
                   <div className="mb-2">
                     <span className="text-sm font-medium text-[#C05A2D]">{p.shopName}</span>
                   </div>
                  <h1 className="font-['Playfair_Display'] text-2xl font-semibold mb-3">{p.name}</h1>
                  <div className="flex items-center gap-3 mb-4"><StarRow rating={p.rating} reviews={p.reviews} /><span className="text-xs text-muted-foreground">· Đã bán {p.sold.toLocaleString()}</span></div>
                  <div className="flex items-baseline gap-3 mb-5">
                    <span className="text-2xl font-bold text-[#C05A2D]">{fmt(p.price)}</span>
                    {p.originalPrice && <span className="text-base text-muted-foreground line-through">{fmt(p.originalPrice)}</span>}
                  </div>
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Kích thước {selSize && <span className="text-[#C05A2D]">— {selSize}</span>}</p>
                    <div className="flex flex-wrap gap-2">{p.sizes.map((s) => { const unavailable = selColor ? getVariantStock(p, s, selColor) === 0 : !p.variants.some((variant) => variant.size === s && variant.stock > 0 && variant.isActive); return <button key={s} disabled={unavailable} onClick={() => setSelSize(s)} className={`px-3.5 py-1.5 rounded-lg text-sm border transition-all ${unavailable ? "cursor-not-allowed border-border bg-muted text-muted-foreground line-through opacity-60" : selSize === s ? "border-[#C05A2D] bg-[#C05A2D]/10 text-[#C05A2D] font-medium" : "border-border hover:border-foreground/40"}`}>{s}</button>; })}</div>
                  </div>
                  <div className="mb-5">
                    <p className="text-sm font-medium mb-2">Màu sắc {selColor && <span className="text-[#C05A2D]">— {selColor}</span>}</p>
                    <div className="flex flex-wrap gap-2">{p.colors.map((c) => { const unavailable = selSize ? getVariantStock(p, selSize, c) === 0 : !p.variants.some((variant) => variant.color === c && variant.stock > 0 && variant.isActive); return <button key={c} disabled={unavailable} onClick={() => setSelColor(c)} className={`px-3.5 py-1.5 rounded-lg text-sm border transition-all ${unavailable ? "cursor-not-allowed border-border bg-muted text-muted-foreground line-through opacity-60" : selColor === c ? "border-[#C05A2D] bg-[#C05A2D]/10 text-[#C05A2D] font-medium" : "border-border hover:border-foreground/40"}`}>{c}</button>; })}</div>
                  </div>
                  {selSize && selColor && <p className={`mb-4 rounded-lg px-3 py-2 text-xs ${selectedVariant && selectedVariant.stock > 0 ? selectedVariant.stock <= 3 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{selectedVariant && selectedVariant.stock > 0 ? `Còn ${selectedVariant.stock} sản phẩm · SKU ${selectedVariant.sku}` : "Tổ hợp size và màu này đã hết hàng."}</p>}
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">{p.description}</p>
                  <div className="flex gap-3">
                    <button onClick={addToCart} disabled={!canAdd} className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${canAdd ? "bg-[#C05A2D] text-white hover:bg-[#A84D25] shadow-sm" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>{canAdd ? "Thêm vào giỏ hàng" : selSize && selColor ? "Biến thể đã hết hàng" : "Chọn size và màu"}</button>
                    <button onClick={() => openConvo()} className="px-4 py-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors flex items-center gap-2"><MessageCircle size={15} /> Chat</button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">{p.tags.map((t) => <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-secondary rounded-full text-xs text-muted-foreground"><Tag size={10} />{t}</span>)}</div>
                </div>
              </div>
              <section className="mt-12">
                <h2 className="font-['Playfair_Display'] text-lg font-semibold mb-4">Sản phẩm cùng shop</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{allProducts.filter((x) => x.shopId === p.shopId && x.id !== p.id).slice(0,4).map((x) => <ProductCard key={x.id} product={x} liked={liked.includes(x.id)} onLike={toggleLike} onClick={openProduct} />)}</div>
              </section>
            </div>
          );
        })()}

        {/* ── Cart ── */}
        {view === "cart" && (() => {
          if (checkout === "success") return (
            <div className="max-w-lg mx-auto px-4 py-16 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5"><Check size={36} className="text-green-600" /></div>
              <h2 className="font-['Playfair_Display'] text-2xl font-semibold mb-2">Đặt hàng thành công!</h2>
              <p className="text-muted-foreground mb-5">Mã đơn hàng <span className="font-mono font-semibold text-foreground">{lastOrder?.id}</span></p>
              <div className="bg-secondary rounded-2xl p-4 text-left mb-6 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Phương thức</span><span className="font-medium">{lastOrder?.paymentMethod === "cod" ? "Thanh toán khi nhận hàng" : lastOrder?.paymentMethod === "bank" ? "Ngân hàng" : "Ví điện tử"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Thanh toán</span><span className={lastOrder?.paymentStatus === "paid" ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>{lastOrder?.paymentStatus === "paid" ? "Đã thanh toán" : "Chờ thanh toán"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tổng tiền</span><span className="font-semibold text-[#C05A2D]">{fmt(lastOrder?.total || 0)}</span></div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center"><button onClick={() => { setSelectedOrderId(lastOrder?.id || null); setCheckout("bag"); setView("orders"); }} className="px-6 py-2.5 border border-border rounded-full text-sm font-medium hover:bg-secondary">Theo dõi đơn hàng</button><button onClick={() => { setCheckout("bag"); setView("home"); }} className="px-6 py-2.5 bg-[#C05A2D] text-white rounded-full text-sm font-medium hover:bg-[#A84D25] transition-colors">Tiếp tục mua sắm</button></div>
            </div>
          );
          if (checkout === "payment") return (
            <div className="max-w-5xl mx-auto px-4 py-6">
              <button onClick={() => setCheckout("bag")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"><ArrowLeft size={15} /> Giỏ hàng</button>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6"><span className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center"><Check size={12}/></span><span>Chọn sản phẩm</span><span className="h-px w-8 bg-border"/><span className="w-6 h-6 rounded-full bg-[#C05A2D] text-white flex items-center justify-center">2</span><span>Thanh toán</span><span className="h-px w-8 bg-border"/><span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">3</span><span>Hoàn tất</span></div>
              <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-6">
                <div className="space-y-5">
                  <section className="bg-card border border-border rounded-2xl p-5"><div className="flex items-center justify-between mb-4"><h2 className="font-['Playfair_Display'] text-lg font-semibold">Địa chỉ giao hàng</h2><button onClick={() => setPayForm({ ...payForm, ...savedAddress })} className="text-xs text-[#C05A2D] font-medium">Dùng địa chỉ đã lưu</button></div><div className="space-y-3"><input placeholder="Họ và tên" value={payForm.name} onChange={(e) => setPayForm({ ...payForm, name:e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30"/><input inputMode="tel" placeholder="Số điện thoại" value={payForm.phone} onChange={(e) => setPayForm({ ...payForm, phone:e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30"/><textarea placeholder="Địa chỉ giao hàng" value={payForm.address} onChange={(e) => setPayForm({ ...payForm, address:e.target.value })} rows={3} className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30 resize-none"/></div></section>
                  <section className="bg-card border border-border rounded-2xl p-5"><h3 className="font-semibold mb-3 flex items-center gap-2"><TicketPercent size={17} className="text-[#C05A2D]"/>Voucher</h3><div className="space-y-2">{VOUCHERS.map((voucher) => { const available = voucher.isActive && cartTotal >= voucher.minimumOrder; return <button key={voucher.code} disabled={!available} onClick={() => setPayForm({ ...payForm, voucher:voucher.code })} className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left ${!available ? "cursor-not-allowed border-border bg-muted/50 opacity-60" : payForm.voucher === voucher.code ? "border-[#C05A2D] bg-[#C05A2D]/5" : "border-border"}`}><span><span className="block text-sm font-medium">{voucher.code === "BEST10" ? "Voucher tốt nhất" : voucher.code}</span><span className="text-xs text-muted-foreground">{voucher.label}{voucher.isActive && cartTotal < voucher.minimumOrder ? ` · Cần đơn từ ${fmt(voucher.minimumOrder)}` : ""}</span></span>{payForm.voucher === voucher.code && available && <Check size={16} className="text-[#C05A2D]"/>}</button>; })}</div></section>
                  <section className="bg-card border border-border rounded-2xl p-5"><h3 className="font-semibold mb-3">Ghi chú với shop</h3><textarea placeholder="Ví dụ: giao giờ hành chính, kiểm tra kỹ sản phẩm..." value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note:e.target.value })} rows={3} className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30 resize-none"/></section>
                  <section className="bg-card border border-border rounded-2xl p-5"><h3 className="font-semibold mb-3 flex items-center gap-2"><CreditCard size={17}/>Phương thức thanh toán</h3><div className="space-y-2">{[["cod","Thanh toán khi nhận hàng (COD)","Thanh toán cho đơn vị vận chuyển"],["transfer","Ngân hàng","Thanh toán trực tuyến qua ngân hàng"],["momo","Ví điện tử","Thanh toán bằng ví điện tử"]].map(([val,label,desc]) => <button key={val} onClick={() => setPayForm({ ...payForm, method:val })} className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-left transition-all ${payForm.method === val ? "border-[#C05A2D] bg-[#C05A2D]/5" : "border-border hover:border-foreground/30"}`}><div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${payForm.method === val ? "border-[#C05A2D]" : "border-muted-foreground"}`}>{payForm.method === val && <div className="w-2 h-2 rounded-full bg-[#C05A2D]"/>}</div><span><span className="block text-sm font-medium">{label}</span><span className="text-xs text-muted-foreground">{desc}</span></span></button>)}</div></section>
                </div>
                <aside><div className="bg-card border border-border rounded-2xl p-5 sticky top-20"><h3 className="font-['Playfair_Display'] font-semibold mb-4">Đơn hàng ({selectedCount} sản phẩm)</h3><div className="space-y-3 max-h-52 overflow-y-auto mb-4">{selectedCart.map((item) => <div key={`${item.product.id}-${item.size}-${item.color}`} className="flex gap-3"><img src={item.product.image} className="w-12 h-14 object-cover rounded-lg" alt=""/><div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{item.product.name}</p><p className="text-[11px] text-muted-foreground">{item.size} · {item.color} · x{item.quantity}</p></div><span className="text-xs font-medium">{fmt(item.product.price * item.quantity)}</span></div>)}</div><div className="border-t border-border pt-3 space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Tạm tính</span><span>{fmt(cartTotal)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Phí vận chuyển</span><span>{fmt(shippingFee)}</span></div><div className="flex justify-between text-green-600"><span>Voucher</span><span>-{fmt(voucherDiscount)}</span></div><div className="flex justify-between font-semibold text-base pt-2 border-t border-border"><span>Tổng thanh toán</span><span className="text-[#C05A2D]">{fmt(checkoutTotal)}</span></div></div>{payError && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{payError}</p>}<button onClick={placeOrder} className="w-full mt-5 py-3 bg-[#C05A2D] text-white rounded-xl text-sm font-medium hover:bg-[#A84D25] transition-colors">Đặt hàng · {fmt(checkoutTotal)}</button><p className="text-[11px] text-muted-foreground text-center mt-3">Bằng việc đặt hàng, bạn xác nhận thông tin trên là chính xác.</p></div></aside>
              </div>
            </div>
          );
          return (
            <div className="max-w-4xl mx-auto px-4 py-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-['Playfair_Display'] text-xl font-semibold">Giỏ hàng {cartCount > 0 && <span className="text-muted-foreground text-base font-normal">({cartCount})</span>}</h2>
                <button onClick={() => setView("home")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Tiếp tục mua sắm</button>
              </div>
              {cart.length === 0
                ? <div className="text-center py-20"><ShoppingBag size={48} className="mx-auto mb-4 text-muted-foreground/40" /><p className="text-muted-foreground font-medium mb-5">Giỏ hàng đang trống</p><button onClick={() => setView("home")} className="px-5 py-2.5 bg-[#C05A2D] text-white rounded-full text-sm font-medium hover:bg-[#A84D25] transition-colors">Khám phá sản phẩm</button></div>
                : <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-3">
                      {cart.map((item, idx) => (
                        <div key={idx} className={`flex gap-3 bg-card p-4 rounded-xl border transition-colors ${item.selected ? "border-[#C05A2D]/40" : "border-border opacity-75"}`}>
                          <button onClick={() => toggleCartSelection(idx)} aria-label={item.selected ? "Bỏ chọn sản phẩm" : "Chọn sản phẩm"} className={`mt-8 w-5 h-5 rounded border shrink-0 flex items-center justify-center ${item.selected ? "bg-[#C05A2D] border-[#C05A2D] text-white" : "border-muted-foreground"}`}>{item.selected && <Check size={13}/>}</button>
                          <img src={item.product.image} alt={item.product.name} className="w-20 h-24 object-cover rounded-lg bg-secondary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">{item.product.shopName}</p>
                            <p className="text-sm font-medium line-clamp-2 mb-1">{item.product.name}</p>
                            <p className="text-xs text-muted-foreground mb-2">{item.size} · {item.color}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-[#C05A2D]">{fmt(item.product.price)}</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateQty(idx,-1)} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-secondary transition-colors"><Minus size={12} /></button>
                                <span className="text-sm w-4 text-center">{item.quantity}</span>
                                <button onClick={() => updateQty(idx, 1)} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-secondary transition-colors"><Plus size={12} /></button>
                                <button onClick={() => removeItem(idx)} className="ml-1 p-1 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="bg-card border border-border rounded-xl p-5 sticky top-20">
                        <h3 className="font-['Playfair_Display'] font-semibold mb-4">Tóm tắt đơn hàng</h3>
                        <div className="space-y-2 mb-4">
                          {selectedCart.length ? selectedCart.map((item, idx) => <div key={idx} className="flex justify-between text-sm"><span className="text-muted-foreground line-clamp-1 flex-1 mr-2">{item.product.name} ×{item.quantity}</span><span className="shrink-0">{fmt(item.product.price * item.quantity)}</span></div>) : <p className="text-sm text-muted-foreground">Chưa chọn sản phẩm nào.</p>}
                        </div>
                        <div className="border-t border-border pt-3 mb-4">
                          <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">Đã chọn</span><span>{selectedCount} sản phẩm</span></div>
                          <div className="flex justify-between font-semibold mt-2"><span>Tạm tính</span><span className="text-[#C05A2D]">{fmt(cartTotal)}</span></div>
                        </div>
                        <button onClick={beginCheckout} disabled={selectedCart.length === 0} className={`w-full py-3 rounded-xl text-sm font-medium transition-colors ${selectedCart.length ? "bg-[#C05A2D] text-white hover:bg-[#A84D25]" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>{selectedCart.length ? `Mua hàng (${selectedCount})` : "Chọn sản phẩm để mua"}</button>
                      </div>
                    </div>
                  </div>}
            </div>
          );
        })()}

        {/* ── Buyer Order Tracking ── */}
        {view === "orders" && (() => {
          const order = buyerOrders.find((item) => item.id === selectedOrderId);
           if (!order) return <div className="max-w-5xl mx-auto px-4 py-6"><div className="flex items-center justify-between mb-6"><div><h2 className="font-['Playfair_Display'] text-xl font-semibold">Đơn mua của tôi</h2><p className="text-sm text-muted-foreground">Theo dõi tình trạng xử lý và giao hàng</p></div><button onClick={() => setView("home")} className="text-sm text-muted-foreground">Tiếp tục mua sắm</button></div>{buyerOrders.length === 0 ? <div className="bg-card border border-dashed border-border rounded-2xl py-16 px-6 text-center"><div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#C05A2D]/10 flex items-center justify-center"><Package size={25} className="text-[#C05A2D]"/></div><h3 className="font-semibold">Bạn chưa có đơn hàng nào</h3><p className="text-sm text-muted-foreground mt-1 mb-5">Các đơn được đặt thành công sẽ xuất hiện tại đây.</p><button onClick={() => setView("home")} className="px-5 py-2.5 bg-[#C05A2D] text-white rounded-full text-sm font-medium">Bắt đầu mua sắm</button></div> : <div className="space-y-3">{buyerOrders.map((item) => { const payment = PAYMENT_STATUS[item.paymentStatus || "pending"]; return <button key={item.id} onClick={() => { setSelectedOrderId(item.id); setOrderNotice(""); }} className="w-full bg-card border border-border rounded-2xl p-4 text-left hover:shadow-sm transition-shadow"><div className="flex flex-wrap items-center justify-between gap-2 mb-3"><div><span className="font-mono text-sm font-semibold">{item.code || item.id}</span><span className="text-xs text-muted-foreground ml-2">{item.date}</span></div><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ORDER_STATUS[item.status].cls}`}>{ORDER_STATUS[item.status].label}</span></div><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center"><Package size={20} className="text-[#C05A2D]"/></div><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{item.items.map((product) => product.name).join(", ")}</p><p className="text-xs text-muted-foreground">{item.items.reduce((sum, product) => sum + product.qty, 0)} sản phẩm · <span className={payment.cls}>{payment.label}</span></p></div><span className="font-semibold text-[#C05A2D]">{fmt(item.total)}</span><ChevronRight size={16} className="text-muted-foreground"/></div></button>; })}</div>}</div>;
          const steps: OrderStatus[] = ["pending", "preparing", "shipping", "completed"];
          const activeIndex = steps.indexOf(order.status);
          const payment = PAYMENT_STATUS[order.paymentStatus || "pending"];
          const canCancel = order.status === "pending" && order.paymentStatus !== "paid";
          return (
            <div className="max-w-5xl mx-auto px-4 py-6">
              <button onClick={() => { setSelectedOrderId(null); setOrderNotice(""); }} className="flex items-center gap-1.5 text-sm text-muted-foreground mb-5"><ArrowLeft size={15}/>Danh sách đơn hàng</button>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div><h2 className="font-['Playfair_Display'] text-xl font-semibold">Đơn hàng {order.code || order.id}</h2><p className="text-sm text-muted-foreground">Cập nhật gần nhất: {order.trackingUpdated || order.date}</p></div>
                <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${ORDER_STATUS[order.status].cls}`}>{ORDER_STATUS[order.status].label}</span>
              </div>
              {orderNotice && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{orderNotice}</div>}
              <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.6fr] gap-5">
                <div className="space-y-5">
                  <section className="bg-card border border-border rounded-2xl p-5">
                    <h3 className="font-semibold mb-5">Tiến độ giao hàng</h3>
                    {order.status === "cancelled" ? <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">Đơn hàng đã được hủy, tồn kho đã được hoàn lại.</div> : <div>{steps.map((step, index) => <div key={step} className="flex gap-4"><div className="flex flex-col items-center"><div className={`w-8 h-8 rounded-full flex items-center justify-center ${index <= activeIndex ? "bg-[#C05A2D] text-white" : "bg-muted text-muted-foreground"}`}>{index < activeIndex ? <Check size={14}/> : index + 1}</div>{index < steps.length - 1 && <div className={`w-0.5 h-10 ${index < activeIndex ? "bg-[#C05A2D]" : "bg-border"}`}/>}</div><div className="pt-1"><p className={`text-sm font-medium ${index <= activeIndex ? "text-foreground" : "text-muted-foreground"}`}>{ORDER_STATUS[step].label}</p>{index === activeIndex && <p className="text-xs text-muted-foreground mt-0.5">Trạng thái hiện tại</p>}</div></div>)}</div>}
                  </section>
                  {order.status === "shipping" && <section className="bg-card border border-border rounded-2xl p-8 text-center"><MapPin size={30} className="mx-auto text-[#C05A2D] mb-2"/><p className="text-sm font-medium">Đơn hàng đang được vận chuyển</p></section>}
                  <section className="bg-card border border-border rounded-2xl p-5"><h3 className="font-semibold mb-3">Sản phẩm</h3>{order.items.map((item) => <div key={item.variantId} className="flex justify-between gap-3 py-3 border-b border-border last:border-0"><div><p className="text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.size} · {item.color} · x{item.qty}</p></div><span className="text-sm">{fmt(item.price * item.qty)}</span></div>)}</section>
                </div>
                <aside className="space-y-4">
                  <section className="bg-card border border-border rounded-2xl p-5"><h3 className="font-semibold mb-3">Thông tin nhận hàng</h3><div className="space-y-2 text-sm"><p>{order.customer} · {order.phone}</p><p className="text-muted-foreground leading-relaxed">{order.address}</p>{order.note && <p className="text-muted-foreground">Ghi chú: {order.note}</p>}</div></section>
                  <section className="bg-card border border-border rounded-2xl p-5 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Phương thức</span><span>{order.paymentMethod === "cod" ? "COD" : order.paymentMethod === "bank" ? "Ngân hàng" : "Ví điện tử"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Thanh toán</span><span className={payment.cls}>{payment.label}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Tạm tính</span><span>{fmt(order.subtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Phí vận chuyển</span><span>{fmt(order.shippingFee)}</span></div>
                    <div className="flex justify-between text-green-600"><span>Voucher {order.voucherCode ? `(${order.voucherCode})` : ""}</span><span>-{fmt(order.discount)}</span></div>
                    <div className="flex justify-between font-semibold border-t border-border pt-3"><span>Tổng cộng</span><span className="text-[#C05A2D]">{fmt(order.total)}</span></div>
                  </section>
                  {canCancel && <button onClick={() => cancelOrder(order)} className="w-full py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50">Hủy đơn hàng</button>}
                  {order.status === "pending" && order.paymentStatus === "paid" && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">Đơn đã thanh toán trực tuyến. Vui lòng liên hệ hỗ trợ nếu cần hủy.</p>}
                  {order.status === "shipping" && <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700">Đơn sẽ chuyển sang Hoàn thành khi quản trị viên hoặc đơn vị giao hàng xác nhận giao thành công.</p>}
                  {order.status === "completed" && <button onClick={() => setOrderNotice("Chức năng hoàn hàng nằm ngoài phạm vi MVP.")} className="w-full py-2.5 border border-border rounded-xl text-sm font-medium flex items-center justify-center gap-2"><RotateCcw size={14}/>Thông tin hoàn hàng</button>}
                </aside>
              </div>
            </div>
          );
        })()}

        {/* ── Messages (buyer) ── */}
        {view === "messages" && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <div className="mb-5">
              <h2 className="font-['Playfair_Display'] text-xl font-semibold">Hỗ trợ khách hàng</h2>
              <p className="text-sm text-muted-foreground mt-1">Trao đổi trực tiếp với quản trị viên DECO về sản phẩm hoặc đơn hàng</p>
            </div>
            <div className="h-[540px] border border-border rounded-2xl bg-card flex flex-col overflow-hidden shadow-sm">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
                <div className="w-10 h-10 rounded-full bg-[#C05A2D] text-white flex items-center justify-center"><ShieldCheck size={19}/></div>
                <div><p className="text-sm font-semibold">Bộ phận hỗ trợ DECO</p><p className="text-xs text-muted-foreground">Quản trị viên hệ thống</p></div>
                <span className="ml-auto flex items-center gap-1.5 text-xs text-green-600"><span className="w-2 h-2 rounded-full bg-green-500"/>Đang hoạt động</span>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {curBC && curBC.messages.length > 0 ? curBC.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                    {m.from === "admin" && <div className="w-7 h-7 rounded-full bg-[#C05A2D]/10 text-[#C05A2D] flex items-center justify-center mr-2 mt-auto shrink-0"><ShieldCheck size={14}/></div>}
                    <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm ${m.from === "user" ? "bg-[#C05A2D] text-white rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                      <p>{m.text}</p>
                      <p className={`text-[10px] mt-1 ${m.from === "user" ? "text-white/60" : "text-muted-foreground"}`}>{m.time}</p>
                    </div>
                  </div>
                )) : <div className="h-full flex items-center justify-center text-center text-muted-foreground"><div><div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#C05A2D]/10 text-[#C05A2D] flex items-center justify-center"><MessageCircle size={25}/></div><p className="text-sm font-medium text-foreground">Bạn cần DECO hỗ trợ điều gì?</p><p className="text-xs mt-1">Hãy nhập nội dung bên dưới để bắt đầu cuộc trò chuyện.</p></div></div>}
                <div ref={msgEnd} />
              </div>
              <div className="p-4 border-t border-border flex gap-2 shrink-0">
                <input value={msgIn} onChange={(e) => setMsgIn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMsg()} placeholder="Nhắn tin cho bộ phận hỗ trợ DECO..." className="flex-1 px-4 py-2.5 bg-muted rounded-full text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
                <button onClick={sendMsg} aria-label="Gửi tin nhắn" className="w-10 h-10 bg-[#C05A2D] text-white rounded-full flex items-center justify-center hover:bg-[#A84D25] transition-colors shrink-0"><Send size={16} /></button>
              </div>
            </div>
          </div>
        )}

      </main>

      <BottomNavigation
        view={view}
        cartCount={cartCount}
        unreadCount={totalUnread}
        authenticated={Boolean(user)}
        onHome={() => setView("home")}
        onSearch={() => {
          setView("search");
          setSearchQ("");
          setSearchResults(null);
          setSearchMeta(null);
          setSearchError("");
        }}
        onCart={() => {
          setView("cart");
          setCheckout("bag");
        }}
        onMessages={openMessages}
        onAccount={() => (user ? setView("orders") : setShowAuth(true))}
      />
    </div>
  );
}
