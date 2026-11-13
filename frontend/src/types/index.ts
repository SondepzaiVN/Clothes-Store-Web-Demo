export type View =
  | "home"
  | "search"
  | "product"
  | "cart"
  | "orders"
  | "messages";

export type AuthMode = "login" | "register";
export type AuthStep = "credentials" | "otp";
export type CheckoutStep = "bag" | "payment" | "success";
export type OrderStatus =
  | "pending"
  | "preparing"
  | "shipping"
  | "completed"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "denied" | "cancelled";

export interface ProductVariant {
  id: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  shopId: string;
  shopName: string;
  image: string;
  category: string;
  tags: string[];
  rating: number;
  reviews: number;
  sold: number;
  description: string;
  sizes: string[];
  colors: string[];
  variants: ProductVariant[];
  isActive: boolean;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  size: string;
  color: string;
  selected: boolean;
}

export interface BuyerMessage {
  id: string;
  from: "user" | "admin";
  text: string;
  time: string;
}

export interface BuyerConversation {
  shopId: string;
  shopName: string;
  shopAvatar: string;
  messages: BuyerMessage[];
  unread: number;
}

export interface AppUser {
  id: string;
  databaseUserId: number;
  name: string;
  email: string;
  role: "CUSTOMER" | "ADMIN";
}

export interface AuthForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  otp: string;
}

export interface OrderItem {
  productId: string;
  variantId: string;
  name: string;
  size: string;
  color: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  customer: string;
  phone: string;
  address: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  voucherCode?: string;
  total: number;
  date: string;
  status: OrderStatus;
  paymentMethod?: "cod" | "bank" | "wallet";
  paymentStatus?: PaymentStatus;
  transactionRef?: string;
  note?: string;
  trackingUpdated?: string;
}

export interface Voucher {
  code: string;
  label: string;
  minimumOrder: number;
  isActive: boolean;
  discount: (total: number) => number;
}
