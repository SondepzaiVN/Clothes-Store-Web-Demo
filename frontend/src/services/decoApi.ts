import type { Product } from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

// Vercel hiện chỉ deploy frontend. Chỉ bật API khi môi trường đã cung cấp
// một backend có thể truy cập công khai; nếu không, giao diện dùng mock data.
export const databaseApiEnabled = import.meta.env.VITE_USE_DATABASE_API === "true";

interface ProductRow {
  ProductID: number;
  Name: string;
  Description: string | null;
  Price: number;
  CategoryName: string;
  PrimaryImageUrl: string | null;
  TotalStock: number;
}

interface VariantRow {
  VariantID: number;
  SKU: string;
  SizeName: string;
  ColorName: string;
  StockQuantity: number;
  IsActive: boolean;
}

interface ProductDetailResponse {
  product: ProductRow & { CreatedAt: string };
  images: Array<{ ImageUrl: string; IsPrimary: boolean }>;
  variants: VariantRow[];
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `API error ${response.status}`);
  return body as T;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export async function loadProductsFromDatabase(): Promise<Product[]> {
  const list = await getJson<{ data: ProductRow[] }>("/api/products?page=1&pageSize=100");
  const details = await Promise.all(
    list.data.map((row) => getJson<ProductDetailResponse>(`/api/products/${row.ProductID}`)),
  );

  return details.map(({ product, images, variants }) => ({
    id: String(product.ProductID),
    name: product.Name,
    price: Number(product.Price),
    shopId: "deco",
    shopName: "DECO Official",
    image: product.PrimaryImageUrl || images[0]?.ImageUrl || "/favicon.svg",
    category: product.CategoryName,
    tags: [product.CategoryName],
    rating: 5,
    reviews: 0,
    sold: 0,
    description: product.Description || "",
    sizes: unique(variants.map((variant) => variant.SizeName)),
    colors: unique(variants.map((variant) => variant.ColorName)),
    variants: variants.map((variant) => ({
      id: String(variant.VariantID),
      sku: variant.SKU,
      size: variant.SizeName,
      color: variant.ColorName,
      stock: variant.StockQuantity,
      isActive: Boolean(variant.IsActive),
    })),
    isActive: true,
    createdAt: product.CreatedAt,
  }));
}

export async function createOrder(payload: {
  userId: number;
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  voucherCode?: string;
  paymentMethod: "COD" | "BANK" | "WALLET";
  note?: string;
  items: Array<{ productVariantId: number; quantity: number }>;
}) {
  return getJson<{ data: unknown[]; output: { OrderID: number; OrderCode: string } }>("/api/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelOrder(orderId: number, userId: number, note?: string) {
  return getJson(`/api/orders/${orderId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ userId, note }),
  });
}

export async function getUserOrders(userId: number) {
  return getJson<{ data: Array<Record<string, unknown>> }>(`/api/users/${userId}/orders?page=1&pageSize=100`);
}

export async function getOrderDetail(orderId: number, requesterUserId: number) {
  return getJson<{ order: Record<string, unknown>; items: Array<Record<string, unknown>>; payments: Array<Record<string, unknown>> }>(`/api/orders/${orderId}?requesterUserId=${requesterUserId}`);
}

export async function simulatePaymentWebhook(paymentId: number, status: "PAID" | "DENIED" = "PAID") {
  return getJson(`/api/payments/${paymentId}/simulate-webhook`, { method:"POST", body:JSON.stringify({ status }) });
}

export async function updateOrderStatus(orderId: number, adminUserId: number, status: "PREPARING" | "SHIPPING", note?: string) {
  return getJson(`/api/admin/orders/${orderId}/status`, { method:"PATCH", body:JSON.stringify({ adminUserId, status, note }) });
}

export async function completeOrder(orderId: number, adminUserId: number, confirmCODCollected = false) {
  return getJson(`/api/admin/orders/${orderId}/complete`, { method:"POST", body:JSON.stringify({ adminUserId, confirmCODCollected, note:"Xác nhận giao hàng thành công" }) });
}

export async function getAdminOrders(adminUserId: number) {
  return getJson<{ data: Array<Record<string, unknown>> }>(`/api/admin/orders?adminUserId=${adminUserId}&pageSize=100`);
}

export async function createAdminProduct(payload: Record<string, unknown>) {
  return getJson<{ data: unknown[]; output: { ProductID: number } }>("/api/admin/products", { method:"POST", body:JSON.stringify(payload) });
}

export async function updateAdminProduct(productId: number, payload: Record<string, unknown>) {
  return getJson(`/api/admin/products/${productId}`, { method:"PATCH", body:JSON.stringify(payload) });
}

export async function setAdminProductActive(productId: number, adminUserId: number, isActive: boolean) {
  return getJson(`/api/admin/products/${productId}/active`, { method:"PATCH", body:JSON.stringify({ adminUserId, isActive }) });
}

export async function saveAdminVariant(payload: Record<string, unknown>) {
  return getJson("/api/admin/variants", { method:"POST", body:JSON.stringify(payload) });
}

export async function adjustAdminStock(variantId: number, adminUserId: number, quantityChange: number) {
  return getJson(`/api/admin/variants/${variantId}/stock`, { method:"PATCH", body:JSON.stringify({ adminUserId, quantityChange }) });
}
