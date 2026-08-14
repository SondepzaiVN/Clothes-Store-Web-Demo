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
  name: string;
  email: string;
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
  total: number;
  date: string;
  status: OrderStatus;
  paymentMethod?: "cod" | "bank" | "wallet";
  paymentStatus?: "pending" | "paid" | "failed";
  note?: string;
  trackingUpdated?: string;
}

export interface Voucher {
  code: string;
  label: string;
  discount: (total: number) => number;
}
