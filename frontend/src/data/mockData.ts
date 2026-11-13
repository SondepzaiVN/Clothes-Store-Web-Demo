import type {
  BuyerConversation,
  Order,
  OrderStatus,
  PaymentStatus,
  Product,
  ProductVariant,
  Voucher,
} from "../types";

export const CATEGORIES = ["Tất cả", "Áo", "Váy", "Quần", "Áo khoác"];

type ProductSeed = Omit<Product, "variants" | "isActive" | "createdAt">;

const STOCK_OVERRIDES: Record<string, number> = {
  "p1|XS|Trắng": 0,
  "p1|M|Kem": 2,
  "p2|L|Vàng": 0,
  "p3|XL|Đen": 1,
  "p4|S|Nâu đất": 0,
  "p5|M|Đỏ đô": 2,
  "p6|XXL|Đen": 0,
  "p7|L|Hồng": 1,
  "p8|L/XL|Nâu chocolate": 0,
};

const toSkuPart = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase();

const buildVariants = (product: ProductSeed, productIndex: number): ProductVariant[] =>
  product.colors.flatMap((color, colorIndex) =>
    product.sizes.map((size, sizeIndex) => {
      const key = `${product.id}|${size}|${color}`;
      const stock = STOCK_OVERRIDES[key] ?? ((productIndex + 2) * 5 + colorIndex * 3 + sizeIndex * 4) % 19 + 3;
      return {
        id: `${product.id}-v${colorIndex + 1}${sizeIndex + 1}`,
        sku: `DECO-${product.id.toUpperCase()}-${toSkuPart(color)}-${toSkuPart(size)}`,
        size,
        color,
        stock,
        isActive: true,
      };
    }),
  );

const PRODUCT_SEEDS: ProductSeed[] = [
  {
    id: "p1", name: "Áo Linen Trắng Cổ V", price: 285000, originalPrice: 380000,
    shopId: "deco", shopName: "DECO", image: "/images/linen_shirt.png", category: "Áo",
    tags: ["linen", "công sở"], rating: 4.8, reviews: 234, sold: 891,
    description: "Áo linen cao cấp, thoáng mát, phù hợp để đi làm và đi chơi.",
    sizes: ["XS", "S", "M", "L", "XL"], colors: ["Trắng", "Kem", "Xanh nhạt"],
  },
  {
    id: "p2", name: "Váy Midi Hoa Nhí Vintage", price: 420000,
    shopId: "deco", shopName: "DECO", image: "/images/vintage_dress.png", category: "Váy",
    tags: ["vintage", "midi"], rating: 4.9, reviews: 567, sold: 1230,
    description: "Váy midi họa tiết hoa nhí với lớp voan mềm mại và lớp lót trong.",
    sizes: ["S", "M", "L"], colors: ["Hồng phấn", "Xanh sage", "Vàng"],
  },
  {
    id: "p3", name: "Quần Wide Leg Kaki", price: 350000, originalPrice: 450000,
    shopId: "deco", shopName: "DECO", image: "/images/kaki_pants.png", category: "Quần",
    tags: ["wide-leg", "kaki"], rating: 4.7, reviews: 189, sold: 654,
    description: "Quần kaki ống rộng, cạp cao và chất vải đứng dáng.",
    sizes: ["S", "M", "L", "XL"], colors: ["Be", "Đen", "Xám"],
  },
  {
    id: "p4", name: "Áo Croptop Ribbed Cotton", price: 195000,
    shopId: "deco", shopName: "DECO", image: "/images/ribbed_croptop.png", category: "Áo",
    tags: ["croptop", "ribbed"], rating: 4.6, reviews: 412, sold: 2100,
    description: "Áo croptop cotton gân co giãn, mềm và dễ phối đồ.",
    sizes: ["XS", "S", "M", "L"], colors: ["Trắng", "Đen", "Nâu đất", "Navy"],
  },
  {
    id: "p5", name: "Đầm Suông Lụa Satin", price: 680000, originalPrice: 850000,
    shopId: "deco", shopName: "DECO", image: "/images/satin_dress.png", category: "Váy",
    tags: ["lụa", "dự tiệc"], rating: 4.9, reviews: 98, sold: 320,
    description: "Đầm suông satin thanh lịch, phù hợp cho các buổi tiệc.",
    sizes: ["S", "M", "L"], colors: ["Đen", "Đỏ đô", "Champagne"],
  },
  {
    id: "p6", name: "Áo Khoác Denim Vintage", price: 520000,
    shopId: "deco", shopName: "DECO", image: "/images/denim_jacket.png", category: "Áo khoác",
    tags: ["denim", "vintage"], rating: 4.8, reviews: 276, sold: 789,
    description: "Áo khoác denim wash phong cách vintage, form unisex.",
    sizes: ["S", "M", "L", "XL", "XXL"], colors: ["Xanh nhạt", "Xanh đậm", "Đen"],
  },
  {
    id: "p7", name: "Chân Váy Xếp Ly Midi", price: 295000,
    shopId: "deco", shopName: "DECO", image: "/images/pleated_skirt.png", category: "Váy",
    tags: ["xếp ly", "midi"], rating: 4.7, reviews: 334, sold: 1087,
    description: "Chân váy xếp ly dáng midi với chất vải ít nhăn.",
    sizes: ["S", "M", "L"], colors: ["Đen", "Trắng ngà", "Hồng"],
  },
  {
    id: "p8", name: "Áo Len Cổ Lọ Oversized", price: 380000, originalPrice: 480000,
    shopId: "deco", shopName: "DECO", image: "/images/turtleneck_sweater.png", category: "Áo",
    tags: ["len", "cổ lọ"], rating: 4.9, reviews: 445, sold: 1560,
    description: "Áo len cổ lọ form rộng, ấm áp và dễ phối trang phục.",
    sizes: ["S/M", "L/XL"], colors: ["Be kem", "Xám khói", "Nâu chocolate"],
  },
];

export const BASE_PRODUCTS: Product[] = PRODUCT_SEEDS.map((product, index) => ({
  ...product,
  variants: buildVariants(product, index),
  isActive: true,
  createdAt: `2026-10-${String(index + 1).padStart(2, "0")}T08:00:00`,
}));

export const VOUCHERS: Voucher[] = [
  { code: "BEST10", label: "Giảm 10% - tối đa 50.000đ", minimumOrder: 0, isActive: true, discount: (total) => Math.min(50000, Math.round(total * 0.1)) },
  { code: "DECO30", label: "Giảm 30.000đ cho đơn từ 300.000đ", minimumOrder: 300000, isActive: true, discount: (total) => total >= 300000 ? 30000 : 0 },
  { code: "WELCOME50", label: "Giảm 50.000đ cho đơn từ 700.000đ", minimumOrder: 700000, isActive: true, discount: (total) => total >= 700000 ? 50000 : 0 },
  { code: "EXPIRED20", label: "Voucher đã hết hạn", minimumOrder: 200000, isActive: false, discount: () => 0 },
  { code: "NONE", label: "Không sử dụng voucher", minimumOrder: 0, isActive: true, discount: () => 0 },
];

export const ORDER_STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  pending: { label: "Chờ xác nhận", cls: "bg-amber-100 text-amber-700" },
  preparing: { label: "Chuẩn bị hàng", cls: "bg-blue-100 text-blue-700" },
  shipping: { label: "Đang giao", cls: "bg-purple-100 text-purple-700" },
  completed: { label: "Hoàn thành", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "Đã hủy", cls: "bg-gray-100 text-gray-500" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; cls: string }> = {
  pending: { label: "Chờ thanh toán", cls: "text-amber-600" },
  paid: { label: "Đã thanh toán", cls: "text-green-600" },
  denied: { label: "Bị từ chối", cls: "text-red-600" },
  cancelled: { label: "Đã hủy", cls: "text-gray-500" },
};

export const DEMO_CUSTOMER = {
  id: "u-demo-001",
  name: "Nguyễn Minh Anh",
  email: "demo@deco.vn",
  password: "Demo@123",
  otp: "123456",
  phone: "0909123456",
  address: "12 Nguyễn Văn Bảo, Phường Hạnh Thông, TP. Hồ Chí Minh",
};

export const DEMO_BUYER_ORDERS: Order[] = [
  {
    id: "DECO-000128", customer: DEMO_CUSTOMER.name, phone: DEMO_CUSTOMER.phone, address: DEMO_CUSTOMER.address,
    items: [{ productId: "p1", variantId: "p1-v22", name: "Áo Linen Trắng Cổ V", size: "M", color: "Kem", qty: 1, price: 285000 }],
    subtotal: 285000, shippingFee: 30000, discount: 28500, voucherCode: "BEST10",
    total: 286500, date: "09/11/2026", status: "pending", paymentMethod: "cod", paymentStatus: "pending",
    note: "Gọi trước khi giao.", trackingUpdated: "09/11/2026 · 18:20",
  },
  {
    id: "DECO-000124", customer: DEMO_CUSTOMER.name, phone: DEMO_CUSTOMER.phone, address: DEMO_CUSTOMER.address,
    items: [{ productId: "p3", variantId: "p3-v13", name: "Quần Wide Leg Kaki", size: "L", color: "Be", qty: 1, price: 350000 }],
    subtotal: 350000, shippingFee: 30000, discount: 35000, voucherCode: "BEST10",
    total: 345000, date: "08/11/2026", status: "preparing", paymentMethod: "bank", paymentStatus: "paid",
    transactionRef: "VCB-20261108-4812", trackingUpdated: "09/11/2026 · 09:15",
  },
  {
    id: "DECO-000119", customer: DEMO_CUSTOMER.name, phone: DEMO_CUSTOMER.phone, address: DEMO_CUSTOMER.address,
    items: [{ productId: "p6", variantId: "p6-v23", name: "Áo Khoác Denim Vintage", size: "L", color: "Xanh đậm", qty: 1, price: 520000 }],
    subtotal: 520000, shippingFee: 30000, discount: 50000, voucherCode: "BEST10",
    total: 500000, date: "06/11/2026", status: "shipping", paymentMethod: "cod", paymentStatus: "pending",
    trackingUpdated: "09/11/2026 · 14:05",
  },
  {
    id: "DECO-000103", customer: DEMO_CUSTOMER.name, phone: DEMO_CUSTOMER.phone, address: DEMO_CUSTOMER.address,
    items: [{ productId: "p2", variantId: "p2-v22", name: "Váy Midi Hoa Nhí Vintage", size: "M", color: "Xanh sage", qty: 1, price: 420000 }],
    subtotal: 420000, shippingFee: 30000, discount: 42000, voucherCode: "BEST10",
    total: 408000, date: "01/11/2026", status: "completed", paymentMethod: "wallet", paymentStatus: "paid",
    transactionRef: "MOMO-20261101-7305", trackingUpdated: "03/11/2026 · 17:40",
  },
  {
    id: "DECO-000097", customer: DEMO_CUSTOMER.name, phone: DEMO_CUSTOMER.phone, address: DEMO_CUSTOMER.address,
    items: [{ productId: "p5", variantId: "p5-v22", name: "Đầm Suông Lụa Satin", size: "M", color: "Đỏ đô", qty: 1, price: 680000 }],
    subtotal: 680000, shippingFee: 30000, discount: 68000, voucherCode: "BEST10",
    total: 642000, date: "29/10/2026", status: "cancelled", paymentMethod: "bank", paymentStatus: "denied",
    transactionRef: "VCB-DENIED-9021", trackingUpdated: "29/10/2026 · 21:12",
  },
];

export const DEMO_BUYER_CONVERSATIONS: BuyerConversation[] = [
  {
    shopId: "deco-support", shopName: "Bộ phận hỗ trợ DECO", shopAvatar: "", unread: 1,
    messages: [
      { id: "msg-1", from: "user", text: "Đơn DECO-000119 của mình đang giao đến đâu rồi ạ?", time: "13:42" },
      { id: "msg-2", from: "admin", text: "Đơn đang được giao và dự kiến đến trong hôm nay. Bạn để ý điện thoại giúp DECO nhé.", time: "13:45" },
    ],
  },
];

export const INITIAL_BUYER_ORDERS: Order[] = [];
export const INITIAL_BUYER_CONVERSATIONS: BuyerConversation[] = [];

export const DECO_SUPPORT_ID = "deco-support";

export const createSupportConversation = (): BuyerConversation => ({
  shopId: DECO_SUPPORT_ID,
  shopName: "Bộ phận hỗ trợ DECO",
  shopAvatar: "",
  messages: [],
  unread: 0,
});
