import React, { useState, useRef, useEffect } from "react";
import {
  Search, ShoppingBag, MessageCircle, Heart, Star, X, ArrowLeft,
  Send, Store, User, ChevronRight, Check, LogOut, Sparkles, Tag,
  Trash2, Minus, Plus, Camera, ChevronDown, Package,
  BarChart2, Settings, Eye, EyeOff, Edit3, DollarSign,
  Users, AlertCircle, Award, ArrowUpRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

type View =
  | "home" | "product" | "cart" | "messages" | "shop-register"
  | "search" | "shop-profile" | "seller-dashboard";
type AuthMode = "login" | "register";
type CheckoutStep = "bag" | "payment" | "success";
type DashView =
  | "overview" | "products" | "add-product" | "orders" | "order-detail"
  | "messages" | "reviews" | "shop-profile" | "edit-shop";
type OrderStatus = "pending" | "preparing" | "shipping" | "completed" | "cancelled";
type ProductStatus = "active" | "out" | "hidden";

interface Product {
  id: string; name: string; price: number; originalPrice?: number;
  shopId: string; shopName: string; image: string; category: string;
  tags: string[]; rating: number; reviews: number; sold: number;
  description: string; sizes: string[]; colors: string[];
}
interface CartItem { product: Product; quantity: number; size: string; color: string; }
interface BuyerMsg { id: string; from: "user" | "shop"; text: string; time: string; }
interface BuyerConvo { shopId: string; shopName: string; shopAvatar: string; messages: BuyerMsg[]; unread: number; }
interface AppUser { id: string; name: string; email: string; hasShop: boolean; shopId?: string; }
interface ShopForm { name: string; desc: string; phone: string; address: string; }
interface ManagedProduct {
  id: string; name: string; image: string; category: string;
  price: number; stock: number; sold: number; status: ProductStatus;
}
interface OrderItem { name: string; size: string; color: string; qty: number; price: number; }
interface Order {
  id: string; customer: string; phone: string; address: string;
  items: OrderItem[]; total: number; date: string; status: OrderStatus;
}
interface Review {
  id: string; customer: string; avatar: string; rating: number;
  product: string; content: string; date: string; reply?: string;
}
interface SellerMsg { id: string; from: "customer" | "seller"; text: string; time: string; }
interface SellerConvo {
  id: string; customer: string; avatar: string;
  messages: SellerMsg[]; unread: number; relatedProduct?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ";
const fmtShort = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "tr" :
  n >= 1_000 ? (n / 1_000).toFixed(0) + "k" : String(n);
const pct = (orig: number, sale: number) => Math.round((1 - sale / orig) * 100);

const ORDER_STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  pending:   { label: "Chờ xác nhận",    cls: "bg-amber-100 text-amber-700" },
  preparing: { label: "Chuẩn bị hàng",   cls: "bg-blue-100 text-blue-700" },
  shipping:  { label: "Đang giao",        cls: "bg-purple-100 text-purple-700" },
  completed: { label: "Hoàn thành",       cls: "bg-green-100 text-green-700" },
  cancelled: { label: "Đã hủy",          cls: "bg-gray-100 text-gray-500" },
};
const PROD_STATUS: Record<ProductStatus, { label: string; cls: string }> = {
  active: { label: "Đang bán", cls: "bg-green-100 text-green-700" },
  out:    { label: "Hết hàng", cls: "bg-red-100 text-red-600" },
  hidden: { label: "Đã ẩn",   cls: "bg-gray-100 text-gray-500" },
};

const CATEGORIES = ["Tất cả", "Áo", "Váy", "Quần", "Áo khoác", "Bộ đồ"];

// ─── Mock Data ────────────────────────────────────────────────────────────────

const SHOP_AVATARS: Record<string, string> = {
  s1: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&auto=format",
  s2: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&auto=format",
  s3: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&h=80&fit=crop&auto=format",
  s4: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&auto=format",
  s5: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&auto=format",
};

const SHOP_INFO: Record<string, { name: string; desc: string; banner: string; avatar: string; followers: number; rating: number }> = {
  s1: { name: "Linen & Co.", desc: "Thời trang linen cao cấp, phong cách tối giản", banner: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=900&h=280&fit=crop&auto=format", avatar: SHOP_AVATARS.s1, followers: 12400, rating: 4.8 },
  s2: { name: "Bông Studio", desc: "Váy đầm xinh xắn, phong cách vintage Việt", banner: "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=900&h=280&fit=crop&auto=format", avatar: SHOP_AVATARS.s2, followers: 28900, rating: 4.9 },
  s3: { name: "Muse Closet", desc: "Basic & trendy cho cô nàng hiện đại", banner: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900&h=280&fit=crop&auto=format", avatar: SHOP_AVATARS.s3, followers: 8700, rating: 4.6 },
  s4: { name: "Denim Lab", desc: "Denim chất lượng cao, phong cách thực dụng", banner: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&h=280&fit=crop&auto=format", avatar: SHOP_AVATARS.s4, followers: 15600, rating: 4.7 },
  s5: { name: "Cozy Knits", desc: "Len và đan móc thủ công, ấm áp cả mùa đông", banner: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=900&h=280&fit=crop&auto=format", avatar: SHOP_AVATARS.s5, followers: 6200, rating: 4.8 },
};

const BASE_PRODUCTS: Product[] = [
  { id:"p1",  name:"Áo Linen Trắng Cổ V",         price:285000, originalPrice:380000, shopId:"s1", shopName:"Linen & Co.", image:"/images/linen_shirt.png", category:"Áo",       tags:["linen","công sở"],    rating:4.8, reviews:234, sold:891,  description:"Áo linen cao cấp chất liệu thoáng mát, phù hợp đi làm và đi chơi.",              sizes:["XS","S","M","L","XL"],            colors:["Trắng","Kem","Xanh nhạt"] },
  { id:"p2",  name:"Váy Midi Hoa Nhí Vintage",     price:420000,                       shopId:"s2", shopName:"Bông Studio", image:"/images/vintage_dress.png", category:"Váy",       tags:["vintage","midi"],     rating:4.9, reviews:567, sold:1230, description:"Váy midi họa tiết hoa nhí vintage, voan mềm mại có lót trong.",                  sizes:["S","M","L"],                      colors:["Hồng phấn","Xanh sage","Vàng"] },
  { id:"p3",  name:"Quần Wide Leg Kaki",            price:350000, originalPrice:450000, shopId:"s1", shopName:"Linen & Co.", image:"/images/kaki_pants.png", category:"Quần",      tags:["wide-leg","kaki"],    rating:4.7, reviews:189, sold:654,  description:"Quần wide leg kaki cao cấp dày dặn, cạp cao tôn dáng.",                          sizes:["S","M","L","XL"],                 colors:["Be","Đen","Xám"] },
  { id:"p4",  name:"Áo Croptop Ribbed Cotton",      price:195000,                       shopId:"s3", shopName:"Muse Closet", image:"/images/ribbed_croptop.png", category:"Áo",       tags:["crop top","ribbed"],  rating:4.6, reviews:412, sold:2100, description:"Áo crop top ribbed cotton co giãn 4 chiều, ôm dáng đẹp.",                        sizes:["XS","S","M","L"],                 colors:["Trắng","Đen","Nâu đất","Navy"] },
  { id:"p5",  name:"Đầm Suông Lụa Satin",           price:680000, originalPrice:850000, shopId:"s2", shopName:"Bông Studio", image:"/images/satin_dress.png", category:"Váy",       tags:["lụa","dự tiệc"],     rating:4.9, reviews:98,  sold:320,  description:"Đầm suông lụa satin cao cấp phù hợp dự tiệc, sang trọng tự nhiên.",              sizes:["S","M","L"],                      colors:["Đen","Đỏ đô","Champagne"] },
  { id:"p6",  name:"Áo Khoác Denim Vintage",        price:520000,                       shopId:"s4", shopName:"Denim Lab",   image:"/images/denim_jacket.png", category:"Áo khoác", tags:["denim","vintage"],    rating:4.8, reviews:276, sold:789,  description:"Áo khoác denim vintage wash unisex, chất dày dặn.",                               sizes:["S","M","L","XL","XXL"],           colors:["Xanh nhạt","Xanh đậm","Đen"] },
  { id:"p7",  name:"Chân Váy Xếp Ly Midi",          price:295000,                       shopId:"s3", shopName:"Muse Closet", image:"/images/pleated_skirt.png", category:"Váy",       tags:["xếp ly","midi"],     rating:4.7, reviews:334, sold:1087, description:"Chân váy xếp ly midi thanh lịch, vải tốt không nhăn.",                           sizes:["S","M","L"],                      colors:["Đen","Trắng ngà","Hồng cánh sen"] },
  { id:"p8",  name:"Áo Len Cổ Lọ Oversized",        price:380000, originalPrice:480000, shopId:"s5", shopName:"Cozy Knits",  image:"/images/turtleneck_sweater.png", category:"Áo",       tags:["len","cổ lọ"],       rating:4.9, reviews:445, sold:1560, description:"Áo len cổ lọ merino wool cao cấp, form oversized ấm áp.",                        sizes:["S/M","L/XL"],                     colors:["Be kem","Xám khói","Nâu chocolate"] },
  { id:"p9",  name:"Quần Jeans Ống Thẳng",           price:450000,                       shopId:"s4", shopName:"Denim Lab",   image:"https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=600&h=750&fit=crop&auto=format", category:"Quần",      tags:["jeans","ống thẳng"], rating:4.6, reviews:521, sold:2340, description:"Quần jeans ống thẳng classic cạp cao tôn dáng.",                                  sizes:["26","27","28","29","30","31","32"],colors:["Xanh nhạt","Xanh trung","Đen"] },
  { id:"p10", name:"Váy Tennis Thêu Hoa",            price:310000,                       shopId:"s2", shopName:"Bông Studio", image:"https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=750&fit=crop&auto=format", category:"Váy",       tags:["tennis","thêu"],     rating:4.8, reviews:198, sold:678,  description:"Váy tennis phong cách Hàn Quốc, chi tiết thêu hoa tinh tế.",                     sizes:["S","M","L","XL"],                 colors:["Trắng","Xanh mint","Hồng nhạt"] },
  { id:"p11", name:"Blazer Tweed Cổ Điển",           price:750000,                       shopId:"s1", shopName:"Linen & Co.", image:"https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&h=750&fit=crop&auto=format", category:"Áo khoác", tags:["blazer","sang trọng"],rating:4.9, reviews:87,  sold:210,  description:"Blazer tweed phong cách châu Âu, cúc mạ vàng, lót trong cao cấp.",               sizes:["S","M","L"],                      colors:["Kem đen","Xám nâu","Navy"] },
  { id:"p12", name:"Bộ Linen Thêu Truyền Thống",     price:560000, originalPrice:700000, shopId:"s5", shopName:"Cozy Knits",  image:"https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&h=750&fit=crop&auto=format", category:"Bộ đồ",    tags:["linen","thêu tay"],  rating:4.7, reviews:156, sold:445,  description:"Bộ linen thêu hoa văn Việt Nam truyền thống, mềm mại thoáng mát.",               sizes:["S","M","L","XL"],                 colors:["Trắng","Vàng nhạt","Xanh lam"] },
];

const SELL_IMGS = [
  "https://images.unsplash.com/photo-1594938298603-c8148c4b4f3b?w=600&h=750&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&h=750&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=600&h=750&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&h=750&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&h=750&fit=crop&auto=format",
];

const INIT_MANAGED: ManagedProduct[] = [
  { id:"mp1", name:"Áo Linen Trắng Cổ V",     image:"/images/linen_shirt.png", category:"Áo",       price:285000, stock:45, sold:891,  status:"active" },
  { id:"mp2", name:"Quần Wide Leg Kaki",        image:"/images/kaki_pants.png", category:"Quần",     price:350000, stock:0,  sold:654,  status:"out" },
  { id:"mp3", name:"Blazer Tweed Cổ Điển",      image:"https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=120&h=120&fit=crop&auto=format", category:"Áo khoác", price:750000, stock:12, sold:210,  status:"active" },
  { id:"mp4", name:"Áo Len Cổ Lọ Oversized",   image:"/images/turtleneck_sweater.png", category:"Áo",       price:380000, stock:0,  sold:156,  status:"hidden" },
];

const INIT_ORDERS: Order[] = [
  { id:"ORD-001", customer:"Nguyễn Thị Lan",   phone:"0901 234 567", address:"123 Lê Lợi, Q1, TP.HCM",             items:[{name:"Áo Linen Trắng Cổ V",size:"M",color:"Trắng",qty:1,price:285000},{name:"Quần Wide Leg Kaki",size:"S",color:"Be",qty:1,price:350000}], total:635000,  date:"05/07/2026", status:"pending" },
  { id:"ORD-002", customer:"Trần Văn Minh",     phone:"0912 345 678", address:"45 Nguyễn Huệ, Q1, TP.HCM",          items:[{name:"Blazer Tweed Cổ Điển",size:"M",color:"Navy",qty:1,price:750000}],                                                                   total:750000,  date:"04/07/2026", status:"preparing" },
  { id:"ORD-003", customer:"Phạm Ngọc Hoa",     phone:"0938 456 789", address:"78 Đinh Tiên Hoàng, Q. Bình Thạnh",  items:[{name:"Áo Linen Trắng Cổ V",size:"L",color:"Kem",qty:2,price:285000}],                                                                     total:570000,  date:"03/07/2026", status:"shipping" },
  { id:"ORD-004", customer:"Lê Thu Hương",       phone:"0967 567 890", address:"12 Cách Mạng Tháng 8, Q.3",          items:[{name:"Blazer Tweed Cổ Điển",size:"S",color:"Kem đen",qty:1,price:750000},{name:"Quần Wide Leg Kaki",size:"M",color:"Đen",qty:1,price:350000}],total:1100000, date:"02/07/2026", status:"completed" },
  { id:"ORD-005", customer:"Vũ Đình Long",       phone:"0978 678 901", address:"56 Võ Văn Tần, Q.3",                  items:[{name:"Áo Len Cổ Lọ Oversized",size:"L/XL",color:"Xám khói",qty:1,price:380000}],                                                          total:380000,  date:"01/07/2026", status:"cancelled" },
  { id:"ORD-006", customer:"Hoàng Thị Mai",      phone:"0989 789 012", address:"90 Pasteur, Q.1",                     items:[{name:"Quần Wide Leg Kaki",size:"M",color:"Xám",qty:1,price:350000}],                                                                       total:350000,  date:"30/06/2026", status:"completed" },
];

const INIT_REVIEWS: Review[] = [
  { id:"rv1", customer:"Nguyễn Minh Châu", avatar:"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop&auto=format", rating:5, product:"Áo Linen Trắng Cổ V",   content:"Áo rất đẹp và chất liệu tốt hơn mình nghĩ. Giao hàng nhanh, đóng gói cẩn thận. Sẽ ủng hộ shop dài dài 🌸",                   date:"03/07/2026" },
  { id:"rv2", customer:"Trần Lan Anh",     avatar:"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&auto=format", rating:4, product:"Blazer Tweed Cổ Điển",  content:"Blazer đẹp như hình, chất liệu tốt. Chỉ hơi lâu giao hàng nhưng nhìn chung mình rất hài lòng.",                               date:"02/07/2026", reply:"Cảm ơn bạn! Shop sẽ cải thiện thời gian giao hàng. Chúc bạn mặc đẹp 🌹" },
  { id:"rv3", customer:"Phạm Thu Hoa",     avatar:"https://images.unsplash.com/photo-1517841905240-472988babdf9?w=60&h=60&fit=crop&auto=format", rating:5, product:"Quần Wide Leg Kaki",    content:"Quần đúng như mô tả, vải dày dặn mặc rất thoải mái. Size chuẩn, mình lấy M vừa đẹp. Recommend cho các bạn!",                  date:"30/06/2026" },
  { id:"rv4", customer:"Lê Thu Hương",     avatar:"https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=60&h=60&fit=crop&auto=format", rating:5, product:"Áo Linen Trắng Cổ V",   content:"Shop rất nhiệt tình tư vấn size. Áo mặc mát và thoáng, rất phù hợp đi làm văn phòng. Cực kỳ hài lòng!",                       date:"28/06/2026" },
];

const REVENUE_DATA = [
  { day:"T2", revenue:1200000, orders:4 },
  { day:"T3", revenue:850000,  orders:3 },
  { day:"T4", revenue:1650000, orders:6 },
  { day:"T5", revenue:920000,  orders:3 },
  { day:"T6", revenue:2100000, orders:7 },
  { day:"T7", revenue:1800000, orders:6 },
  { day:"CN", revenue:750000,  orders:2 },
];

const INIT_SELLER_CONVOS: SellerConvo[] = [
  { id:"sc1", customer:"Nguyễn Thị Lan",   avatar:"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop&auto=format", unread:2, relatedProduct:"Áo Linen Trắng Cổ V",
    messages:[
      { id:"sm1", from:"customer", text:"Shop ơi cho mình hỏi áo linen có mỏng không ạ?",      time:"10:23" },
      { id:"sm2", from:"seller",   text:"Dạ áo linen bên mình dày vừa phải, không bị thấu 🌸", time:"10:25" },
      { id:"sm3", from:"customer", text:"Vậy mình mua size M nha shop",                          time:"10:30" },
      { id:"sm4", from:"customer", text:"Shop ơi cho mình đổi sang size L được không?",          time:"11:45" },
    ]},
  { id:"sc2", customer:"Trần Minh Châu",   avatar:"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&auto=format", unread:0, relatedProduct:"Váy Midi Hoa Nhí",
    messages:[
      { id:"sm5", from:"customer", text:"Cho mình hỏi váy midi còn màu xanh sage không?",       time:"Hôm qua" },
      { id:"sm6", from:"seller",   text:"Dạ còn! Màu xanh sage có đủ size S, M, L nha bạn 🌿", time:"Hôm qua" },
    ]},
  { id:"sc3", customer:"Phạm Thu Hoa",     avatar:"https://images.unsplash.com/photo-1517841905240-472988babdf9?w=60&h=60&fit=crop&auto=format", unread:1,
    messages:[
      { id:"sm7", from:"customer", text:"Đơn hàng ORD-003 của mình đến chưa shop?", time:"09:15" },
    ]},
];

const INIT_BUYER_CONVOS: BuyerConvo[] = [
  { shopId:"s2", shopName:"Bông Studio", shopAvatar:SHOP_AVATARS.s2, unread:1,
    messages:[
      { id:"bm1", from:"user", text:"Shop ơi, váy midi còn size M không?", time:"10:32" },
      { id:"bm2", from:"shop", text:"Dạ còn ạ! Có màu hồng phấn và xanh sage nha bạn 🌸", time:"10:35" },
    ]},
  { shopId:"s1", shopName:"Linen & Co.", shopAvatar:SHOP_AVATARS.s1, unread:0,
    messages:[
      { id:"bm3", from:"shop", text:"Đơn hàng đã giao thành công 📦", time:"Hôm qua" },
    ]},
];

// ─── Shared UI components ─────────────────────────────────────────────────────

function StarRow({ rating, reviews }: { rating: number; reviews: number }) {
  return (
    <span className="flex items-center gap-1">
      <Star size={12} className="fill-[#C05A2D] text-[#C05A2D]" />
      <span className="text-xs font-medium text-[#C05A2D]">{rating}</span>
      <span className="text-xs text-muted-foreground">({reviews})</span>
    </span>
  );
}

function ProductCard({ product, liked, onLike, onClick }: {
  product: Product; liked: boolean;
  onLike: (id: string) => void; onClick: (p: Product) => void;
}) {
  return (
    <div
      className="group cursor-pointer bg-card rounded-xl overflow-hidden border border-border hover:shadow-lg transition-shadow duration-300"
      onClick={() => onClick(product)}
    >
      <div className="relative overflow-hidden bg-secondary aspect-[3/4]">
        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        {product.originalPrice && (
          <span className="absolute top-2.5 left-2.5 bg-[#C05A2D] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            -{pct(product.originalPrice, product.price)}%
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onLike(product.id); }}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
        >
          <Heart size={15} className={liked ? "fill-[#C05A2D] text-[#C05A2D]" : "text-muted-foreground"} />
        </button>
      </div>
      <div className="p-3">
        <p className="text-[11px] text-muted-foreground mb-0.5">{product.shopName}</p>
        <h3 className="text-sm font-medium leading-snug line-clamp-2 mb-2">{product.name}</h3>
        <StarRow rating={product.rating} reviews={product.reviews} />
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-sm font-semibold text-[#C05A2D]">{fmt(product.price)}</span>
          {product.originalPrice && <span className="text-xs text-muted-foreground line-through">{fmt(product.originalPrice)}</span>}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">Đã bán {product.sold.toLocaleString()}</p>
      </div>
    </div>
  );
}

function CatBadge({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${active ? "bg-[#C05A2D] text-white shadow-sm" : "bg-secondary text-foreground hover:bg-secondary/70"}`}>
      {label}
    </button>
  );
}

function StatCard({ icon, label, value, sub, trend }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; trend?: "up" | "down";
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-[#C05A2D]/10 rounded-xl flex items-center justify-center text-[#C05A2D]">{icon}</div>
        {trend && (
          <span className={`text-xs font-medium flex items-center gap-0.5 ${trend === "up" ? "text-green-600" : "text-red-500"}`}>
            <ArrowUpRight size={12} className={trend === "down" ? "rotate-180" : ""} />
            {trend === "up" ? "+12%" : "-3%"}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold mb-0.5">{value}</p>
      <p className="text-xs font-medium">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Buyer Shop Profile (standalone for hooks) ────────────────────────────────

function ShopProfileView({ sid, allProducts, user, shopForm, liked, toggleLike, openProduct, openConvo, goBack, goSell }: {
  sid: string; allProducts: Product[]; user: AppUser | null; shopForm: ShopForm;
  liked: string[]; toggleLike(id: string): void; openProduct(p: Product): void;
  openConvo(shopId: string, name: string): void; goBack(): void; goSell(): void;
}) {
  const [tab, setTab] = useState<"products" | "about">("products");
  const isOwn = user?.shopId === sid;
  const prods = allProducts.filter((p) => p.shopId === sid);
  const sold = prods.reduce((a, p) => a + p.sold, 0);
  const info = SHOP_INFO[sid] ?? {
    name: shopForm.name || (user ? user.name + " Shop" : "Shop của tôi"),
    desc: shopForm.desc || "Chào mừng đến với shop!",
    banner: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=900&h=280&fit=crop&auto=format",
    avatar: SHOP_AVATARS.s1, followers: 0, rating: 5.0,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <button onClick={goBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft size={15} /> Quay lại
      </button>

      {/* Banner */}
      <div className="relative rounded-t-2xl overflow-hidden h-52 bg-secondary">
        <img src={info.banner} alt="banner" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      {/* Header card */}
      <div className="bg-card border border-border border-t-0 rounded-b-2xl px-6 pb-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 mb-4">
          <div className="w-20 h-20 rounded-2xl border-4 border-card overflow-hidden bg-secondary shrink-0 shadow-lg">
            {isOwn
              ? <div className="w-full h-full bg-[#C05A2D] flex items-center justify-center text-white text-3xl font-bold font-['Playfair_Display']">{info.name[0]}</div>
              : <img src={info.avatar} alt={info.name} className="w-full h-full object-cover" />}
          </div>
          <div className="flex-1 flex flex-wrap items-start justify-between gap-3 pt-1">
            <div>
              <h1 className="font-['Playfair_Display'] text-xl font-bold">{info.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{info.desc}</p>
            </div>
            {isOwn
              ? <button onClick={goSell} className="flex items-center gap-1.5 px-4 py-2 bg-[#C05A2D] text-white text-sm font-medium rounded-full hover:bg-[#A84D25] transition-colors"><Plus size={14} /> Đăng sản phẩm</button>
              : <button onClick={() => openConvo(sid, info.name)} className="flex items-center gap-1.5 px-4 py-2 border border-border text-sm font-medium rounded-full hover:bg-secondary transition-colors"><MessageCircle size={14} /> Nhắn tin</button>}
          </div>
        </div>
        <div className="flex gap-6 pt-3 border-t border-border">
          {[["Sản phẩm", prods.length], ["Đã bán", sold.toLocaleString()], ["Theo dõi", info.followers.toLocaleString()], ["Đánh giá", info.rating > 0 ? info.rating.toFixed(1) + " ★" : "Mới"]].map(([l, v]) => (
            <div key={String(l)} className="text-center">
              <p className="text-base font-semibold">{v}</p>
              <p className="text-[11px] text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-5">
        {(["products", "about"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? "border-[#C05A2D] text-[#C05A2D]" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "products" ? `Sản phẩm (${prods.length})` : "Giới thiệu"}
          </button>
        ))}
      </div>

      {tab === "products"
        ? prods.length === 0
          ? <div className="text-center py-20 text-muted-foreground">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Chưa có sản phẩm nào</p>
              {isOwn && <button onClick={goSell} className="mt-4 px-5 py-2.5 bg-[#C05A2D] text-white rounded-full text-sm font-medium hover:bg-[#A84D25] transition-colors">Đăng sản phẩm đầu tiên</button>}
            </div>
          : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {prods.map((p) => <ProductCard key={p.id} product={p} liked={liked.includes(p.id)} onLike={toggleLike} onClick={openProduct} />)}
            </div>
        : <div className="max-w-lg space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-sm font-semibold mb-2">Về shop</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{info.desc}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-sm font-semibold mb-3">Chính sách shop</p>
              {["Giao hàng toàn quốc", "Đổi trả trong 7 ngày", "Hàng chính hãng 100%", "Hỗ trợ 24/7"].map((s) => (
                <div key={s} className="flex items-center gap-2 text-sm text-muted-foreground mb-2"><Check size={13} className="text-[#C05A2D] shrink-0" />{s}</div>
              ))}
            </div>
          </div>}
    </div>
  );
}

// ─── Seller Dashboard (standalone for hooks) ──────────────────────────────────

function SellerDashboard({ user, allProducts, extraProducts, setExtraProducts, shopForm, setShopForm, onBack }: {
  user: AppUser; allProducts: Product[]; extraProducts: Product[];
  setExtraProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  shopForm: ShopForm; setShopForm: React.Dispatch<React.SetStateAction<ShopForm>>;
  onBack(): void;
}) {
  const [dv, setDv] = useState<DashView>("overview");
  const [selOrderId, setSelOrderId] = useState<string | null>(null);
  const [prodTab, setProdTab] = useState<"all" | ProductStatus>("all");
  const [prodSearch, setProdSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<"all" | OrderStatus>("all");
  const [managed, setManaged] = useState<ManagedProduct[]>(INIT_MANAGED);
  const [orders, setOrders] = useState<Order[]>(INIT_ORDERS);
  const [reviews, setReviews] = useState<Review[]>(INIT_REVIEWS);
  const [editForm, setEditForm] = useState({ name: shopForm.name || "My Shop", desc: shopForm.desc || "", phone: shopForm.phone || "", address: shopForm.address || "", email: "shop@email.com" });
  const [sConvos, setSConvos] = useState<SellerConvo[]>(INIT_SELLER_CONVOS);
  const [activeSC, setActiveSC] = useState("sc1");
  const [smInput, setSmInput] = useState("");
  const [addForm, setAddForm] = useState({ name:"", category:"Áo", price:"", origPrice:"", stock:"", desc:"", sizes:[] as string[], colors:"" });
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});
  const smEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { smEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [activeSC, sConvos]);

  const shopName  = shopForm.name || user.name + " Shop";
  const shopId    = user.shopId || "s_new";
  const pending   = orders.filter((o) => o.status === "pending").length;
  const unreadSC  = sConvos.reduce((a, c) => a + c.unread, 0);
  const active    = managed.filter((p) => p.status === "active").length;
  const outOfSt   = managed.filter((p) => p.status === "out").length;
  const avgRating = reviews.length ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : "0";
  const totalRev  = orders.filter((o) => o.status === "completed").reduce((a, o) => a + o.total, 0);

  const filteredP = managed.filter((p) => (prodTab === "all" || p.status === prodTab) && (!prodSearch || p.name.toLowerCase().includes(prodSearch.toLowerCase())));
  const filteredO = orders.filter((o) => orderFilter === "all" || o.status === orderFilter);
  const selOrder  = orders.find((o) => o.id === selOrderId);
  const curSC     = sConvos.find((c) => c.id === activeSC);

  const setOrderStatus = (id: string, s: OrderStatus) => setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: s } : o));
  const toggleHide     = (id: string) => setManaged((prev) => prev.map((p) => p.id === id ? { ...p, status: p.status === "hidden" ? "active" : "hidden" } : p));
  const deleteProd     = (id: string) => setManaged((prev) => prev.filter((p) => p.id !== id));
  const allSizes = ["XS","S","M","L","XL","XXL","26","27","28","29","30","S/M","L/XL"];
  const toggleSize = (s: string) => setAddForm((prev) => ({ ...prev, sizes: prev.sizes.includes(s) ? prev.sizes.filter((x) => x !== s) : [...prev.sizes, s] }));

  const sendSellerMsg = () => {
    if (!smInput.trim()) return;
    const t = new Date().toLocaleTimeString("vi-VN", { hour:"2-digit", minute:"2-digit" });
    setSConvos((prev) => prev.map((c) => c.id === activeSC ? { ...c, messages:[...c.messages, { id: Date.now().toString(), from:"seller", text: smInput.trim(), time: t }] } : c));
    setSmInput("");
  };

  const submitAddProd = () => {
    if (!addForm.name || !addForm.price || addForm.sizes.length === 0) return;
    const img = SELL_IMGS[Math.floor(Math.random() * SELL_IMGS.length)];
    const stock = parseInt(addForm.stock) || 0;
    setManaged((prev) => [{ id:`mp_${Date.now()}`, name:addForm.name, image:img, category:addForm.category, price:parseInt(addForm.price)||0, stock, sold:0, status: stock > 0 ? "active" : "out" }, ...prev]);
    setExtraProducts((prev) => [{ id:`p_${Date.now()}`, name:addForm.name, price:parseInt(addForm.price)||0, originalPrice: addForm.origPrice ? parseInt(addForm.origPrice) : undefined, shopId, shopName, image:img, category:addForm.category, tags:[addForm.category.toLowerCase()], rating:5.0, reviews:0, sold:0, description:addForm.desc||"Sản phẩm mới.", sizes:addForm.sizes, colors: addForm.colors ? addForm.colors.split(",").map((s) => s.trim()).filter(Boolean) : ["Mặc định"] }, ...prev]);
    setAddForm({ name:"", category:"Áo", price:"", origPrice:"", stock:"", desc:"", sizes:[], colors:"" });
    setDv("products");
  };

  const submitReply = (id: string) => {
    if (!replyMap[id]?.trim()) return;
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, reply: replyMap[id] } : r));
    setReplyMap((prev) => ({ ...prev, [id]:"" }));
  };

  const navItems: { id: DashView; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id:"overview",     label:"Tổng quan",   icon:<BarChart2 size={16} /> },
    { id:"products",     label:"Sản phẩm",    icon:<Package size={16} />,       badge: managed.length },
    { id:"orders",       label:"Đơn hàng",    icon:<ShoppingBag size={16} />,   badge: pending || undefined },
    { id:"messages",     label:"Tin nhắn",    icon:<MessageCircle size={16} />, badge: unreadSC || undefined },
    { id:"reviews",      label:"Đánh giá",    icon:<Star size={16} /> },
    { id:"shop-profile", label:"Hồ sơ shop",  icon:<Store size={16} /> },
  ];

  return (
    <div className="flex h-screen bg-background font-['DM_Sans'] overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 bg-card border-r border-border flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-border">
          <p className="font-['Playfair_Display'] text-lg font-bold">VẢI</p>
          <p className="text-xs text-muted-foreground">Kênh người bán</p>
        </div>
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#C05A2D] flex items-center justify-center text-white font-bold text-sm font-['Playfair_Display'] shrink-0">
              {shopName[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{shopName}</p>
              <p className="text-xs text-muted-foreground">{active} sp đang bán</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => { setDv(item.id); setSelOrderId(null); }}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${dv === item.id ? "bg-[#C05A2D]/10 text-[#C05A2D]" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              {item.icon}{item.label}
              {item.badge ? <span className="ml-auto w-5 h-5 bg-[#C05A2D] text-white text-[10px] font-bold rounded-full flex items-center justify-center">{item.badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border space-y-0.5">
          <button onClick={() => setDv("edit-shop")} className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${dv === "edit-shop" ? "bg-[#C05A2D]/10 text-[#C05A2D]" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            <Settings size={16} /> Chỉnh sửa hồ sơ
          </button>
          <button onClick={onBack} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
            <ArrowLeft size={16} /> Về trang chủ
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="p-6 max-w-5xl mx-auto">

          {/* ── Overview ── */}
          {dv === "overview" && (
            <div>
              <div className="mb-6">
                <h1 className="font-['Playfair_Display'] text-2xl font-bold">Tổng quan</h1>
                <p className="text-sm text-muted-foreground mt-1">Dữ liệu 7 ngày gần nhất</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <StatCard icon={<DollarSign size={18} />}    label="Doanh thu hôm nay"   value={fmt(750000)}          sub="2 đơn hoàn thành"           trend="up" />
                <StatCard icon={<ShoppingBag size={18} />}   label="Tổng đơn hàng"       value={String(orders.length)} sub={`${pending} đơn chờ xác nhận`} trend="up" />
                <StatCard icon={<AlertCircle size={18} />}   label="Chờ xác nhận"        value={String(pending)}       sub="Cần xử lý sớm" />
                <StatCard icon={<Package size={18} />}       label="Đang bán"             value={String(active)}        sub={`${outOfSt} sản phẩm hết hàng`} />
                <StatCard icon={<Users size={18} />}         label="Khách hàng mới"       value="18"                    sub="Tuần này"                   trend="up" />
                <StatCard icon={<Award size={18} />}         label="Đánh giá trung bình" value={avgRating + " ★"}       sub={`${reviews.length} đánh giá`} />
              </div>

              {/* Chart */}
              <div className="bg-card border border-border rounded-xl p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-['Playfair_Display'] text-base font-semibold">Doanh thu 7 ngày qua</h2>
                  <span className="text-xs text-muted-foreground">Tổng: {fmt(REVENUE_DATA.reduce((a, d) => a + d.revenue, 0))}</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={REVENUE_DATA} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,20,16,0.08)" vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize:12, fill:"#8A7060" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize:11, fill:"#8A7060" }} tickFormatter={fmtShort} />
                    <Tooltip formatter={(v: number) => [fmt(v), "Doanh thu"]} contentStyle={{ borderRadius:10, border:"1px solid rgba(28,20,16,0.12)", fontSize:12 }} />
                    <Bar dataKey="revenue" fill="#C05A2D" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top products */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-['Playfair_Display'] text-base font-semibold mb-4">Sản phẩm bán chạy</h2>
                <div className="space-y-3">
                  {[...managed].sort((a, b) => b.sold - a.sold).slice(0, 4).map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                      <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-secondary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.category} · tồn {p.stock}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-[#C05A2D]">{p.sold.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">đã bán</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Products ── */}
          {dv === "products" && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h1 className="font-['Playfair_Display'] text-2xl font-bold">Quản lý sản phẩm</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">{managed.length} sản phẩm</p>
                </div>
                <button onClick={() => setDv("add-product")} className="flex items-center gap-2 px-4 py-2 bg-[#C05A2D] text-white text-sm font-medium rounded-full hover:bg-[#A84D25] transition-colors">
                  <Plus size={14} /> Thêm sản phẩm
                </button>
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} placeholder="Tìm sản phẩm..." className="w-full pl-9 pr-3 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {(["all","active","out","hidden"] as const).map((s) => (
                    <button key={s} onClick={() => setProdTab(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${prodTab === s ? "bg-[#C05A2D] text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                      {s === "all" ? "Tất cả" : PROD_STATUS[s].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="hidden sm:grid sm:grid-cols-[56px_1fr_90px_100px_70px_90px_80px] gap-3 px-4 py-2.5 bg-muted text-xs font-semibold text-muted-foreground border-b border-border">
                  <span>Ảnh</span><span>Tên sản phẩm</span><span>Danh mục</span><span>Giá</span><span>Tồn kho</span><span>Trạng thái</span><span className="text-right">Thao tác</span>
                </div>
                {filteredP.length === 0
                  ? <div className="py-16 text-center text-muted-foreground">
                      <Package size={36} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Không có sản phẩm nào</p>
                      <button onClick={() => setDv("add-product")} className="mt-3 px-4 py-2 bg-[#C05A2D] text-white text-sm rounded-full hover:bg-[#A84D25] transition-colors">Thêm sản phẩm đầu tiên</button>
                    </div>
                  : filteredP.map((p) => (
                      <div key={p.id} className="grid grid-cols-[56px_1fr] sm:grid-cols-[56px_1fr_90px_100px_70px_90px_80px] gap-3 items-center px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <img src={p.image} alt={p.name} className="w-12 h-12 rounded-lg object-cover bg-secondary" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium line-clamp-1">{p.name}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">{p.category} · {fmt(p.price)} · tồn {p.stock}</p>
                        </div>
                        <span className="hidden sm:block text-xs text-muted-foreground">{p.category}</span>
                        <span className="hidden sm:block text-sm font-semibold text-[#C05A2D]">{fmt(p.price)}</span>
                        <span className={`hidden sm:block text-sm font-medium ${p.stock === 0 ? "text-red-500" : ""}`}>{p.stock}</span>
                        <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${PROD_STATUS[p.status].cls}`}>{PROD_STATUS[p.status].label}</span>
                        <div className="col-span-2 sm:col-span-1 flex items-center gap-1 justify-end">
                          <button onClick={() => toggleHide(p.id)} title={p.status === "hidden" ? "Hiện" : "Ẩn"} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                            {p.status === "hidden" ? <Eye size={15} /> : <EyeOff size={15} />}
                          </button>
                          <button onClick={() => deleteProd(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-500">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
              </div>
            </div>
          )}

          {/* ── Add Product ── */}
          {dv === "add-product" && (
            <div>
              <button onClick={() => setDv("products")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
                <ArrowLeft size={15} /> Quay lại danh sách
              </button>
              <h1 className="font-['Playfair_Display'] text-2xl font-bold mb-6">Thêm sản phẩm mới</h1>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left */}
                <div className="lg:col-span-2 space-y-5">
                  {/* Image upload */}
                  <div className="bg-card border border-border rounded-xl p-5">
                    <p className="text-sm font-semibold mb-4">Hình ảnh sản phẩm</p>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-2 aspect-square border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#C05A2D]/50 transition-colors group bg-muted/30">
                        <Camera size={24} className="text-muted-foreground group-hover:text-[#C05A2D] transition-colors mb-1.5" />
                        <p className="text-xs text-muted-foreground text-center leading-tight">Ảnh chính<br />(bắt buộc)</p>
                      </div>
                      {[0,1,2].map((i) => (
                        <div key={i} className="aspect-square border-2 border-dashed border-border rounded-xl flex items-center justify-center cursor-pointer hover:border-[#C05A2D]/40 transition-colors bg-muted/30">
                          <Plus size={18} className="text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <p className="text-sm font-semibold">Thông tin sản phẩm</p>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Tên sản phẩm *</label>
                      <input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="VD: Áo Linen Trắng Cổ V" className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Danh mục *</label>
                      <select value={addForm.category} onChange={(e) => setAddForm({ ...addForm, category: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30">
                        {["Áo","Váy","Quần","Áo khoác","Bộ đồ","Phụ kiện"].map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Mô tả sản phẩm</label>
                      <textarea value={addForm.desc} onChange={(e) => setAddForm({ ...addForm, desc: e.target.value })} placeholder="Mô tả chi tiết về chất liệu, kiểu dáng, cách mặc..." rows={4} className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30 resize-none" />
                    </div>
                  </div>

                  {/* Variants */}
                  <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <p className="text-sm font-semibold">Biến thể</p>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Size *</label>
                      <div className="flex flex-wrap gap-2">
                        {allSizes.map((s) => (
                          <button key={s} type="button" onClick={() => toggleSize(s)} className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${addForm.sizes.includes(s) ? "border-[#C05A2D] bg-[#C05A2D]/10 text-[#C05A2D] font-medium" : "border-border hover:border-foreground/40"}`}>{s}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Màu sắc</label>
                      <input value={addForm.colors} onChange={(e) => setAddForm({ ...addForm, colors: e.target.value })} placeholder="Trắng, Đen, Be (cách nhau bằng dấu phẩy)" className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
                    </div>
                  </div>
                </div>

                {/* Right */}
                <div className="space-y-5">
                  <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <p className="text-sm font-semibold">Giá & Tồn kho</p>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Giá bán (đ) *</label>
                      <input value={addForm.price} onChange={(e) => setAddForm({ ...addForm, price: e.target.value })} placeholder="285000" className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Giá gốc (đ)</label>
                      <input value={addForm.origPrice} onChange={(e) => setAddForm({ ...addForm, origPrice: e.target.value })} placeholder="380000" className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Số lượng tồn kho</label>
                      <input value={addForm.stock} onChange={(e) => setAddForm({ ...addForm, stock: e.target.value })} placeholder="100" className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <button onClick={submitAddProd} disabled={!addForm.name || !addForm.price || addForm.sizes.length === 0} className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${addForm.name && addForm.price && addForm.sizes.length > 0 ? "bg-[#C05A2D] text-white hover:bg-[#A84D25]" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>
                      Đăng bán ngay
                    </button>
                    <button onClick={() => setDv("products")} className="w-full py-3 rounded-xl text-sm font-medium border border-border hover:bg-muted transition-colors">
                      Lưu nháp
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Orders ── */}
          {dv === "orders" && !selOrderId && (
            <div>
              <div className="mb-5">
                <h1 className="font-['Playfair_Display'] text-2xl font-bold">Quản lý đơn hàng</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{orders.length} đơn hàng · {pending} chờ xác nhận</p>
              </div>

              <div className="flex gap-1 mb-4 flex-wrap">
                {(["all","pending","preparing","shipping","completed","cancelled"] as const).map((s) => (
                  <button key={s} onClick={() => setOrderFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${orderFilter === s ? "bg-[#C05A2D] text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                    {s === "all" ? "Tất cả" : ORDER_STATUS[s].label}
                    {s !== "all" && <span className="ml-1 opacity-70">({orders.filter((o) => o.status === s).length})</span>}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filteredO.map((order) => (
                  <div key={order.id} className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold font-mono">{order.id}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${ORDER_STATUS[order.status].cls}`}>{ORDER_STATUS[order.status].label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{order.customer} · {order.date}</p>
                      </div>
                      <span className="text-base font-bold text-[#C05A2D] shrink-0">{fmt(order.total)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-1">
                      {order.items.map((it, i) => `${i > 0 ? " · " : ""}${it.name} (${it.size}) ×${it.qty}`).join("")}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => { setSelOrderId(order.id); setDv("order-detail"); }} className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors">
                        Xem chi tiết
                      </button>
                      {order.status === "pending" && <>
                        <button onClick={() => setOrderStatus(order.id,"preparing")} className="px-3 py-1.5 text-xs font-medium bg-[#C05A2D] text-white rounded-lg hover:bg-[#A84D25] transition-colors">Xác nhận đơn</button>
                        <button onClick={() => setOrderStatus(order.id,"cancelled")} className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">Hủy đơn</button>
                      </>}
                      {order.status === "preparing" && <button onClick={() => setOrderStatus(order.id,"shipping")} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Bàn giao vận chuyển</button>}
                      {order.status === "shipping"  && <button onClick={() => setOrderStatus(order.id,"completed")} className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">Xác nhận giao thành công</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Order Detail ── */}
          {dv === "order-detail" && selOrder && (
            <div>
              <button onClick={() => { setDv("orders"); setSelOrderId(null); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
                <ArrowLeft size={15} /> Danh sách đơn hàng
              </button>
              <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h1 className="font-['Playfair_Display'] text-2xl font-bold">Chi tiết đơn hàng</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-mono text-muted-foreground">{selOrder.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS[selOrder.status].cls}`}>{ORDER_STATUS[selOrder.status].label}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {selOrder.status === "pending"   && <><button onClick={() => setOrderStatus(selOrder.id,"preparing")} className="px-4 py-2 bg-[#C05A2D] text-white text-sm font-medium rounded-full hover:bg-[#A84D25] transition-colors">Xác nhận đơn</button><button onClick={() => setOrderStatus(selOrder.id,"cancelled")} className="px-4 py-2 border border-red-200 text-red-500 text-sm font-medium rounded-full hover:bg-red-50 transition-colors">Hủy đơn</button></>}
                  {selOrder.status === "preparing" && <button onClick={() => setOrderStatus(selOrder.id,"shipping")}  className="px-4 py-2 bg-blue-600  text-white text-sm font-medium rounded-full hover:bg-blue-700  transition-colors">Bàn giao vận chuyển</button>}
                  {selOrder.status === "shipping"  && <button onClick={() => setOrderStatus(selOrder.id,"completed")} className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-full hover:bg-green-700 transition-colors">Xác nhận hoàn thành</button>}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 space-y-4">
                  {/* Items */}
                  <div className="bg-card border border-border rounded-xl p-5">
                    <p className="text-sm font-semibold mb-4">Sản phẩm trong đơn</p>
                    {selOrder.items.map((it, i) => (
                      <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center shrink-0"><Package size={16} className="text-muted-foreground" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{it.name}</p>
                          <p className="text-xs text-muted-foreground">{it.size} · {it.color} · ×{it.qty}</p>
                        </div>
                        <span className="text-sm font-semibold text-[#C05A2D] shrink-0">{fmt(it.price * it.qty)}</span>
                      </div>
                    ))}
                    <div className="mt-4 pt-3 border-t border-border flex justify-between font-semibold">
                      <span>Tổng cộng</span>
                      <span className="text-[#C05A2D] text-lg">{fmt(selOrder.total)}</span>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="bg-card border border-border rounded-xl p-5">
                    <p className="text-sm font-semibold mb-4">Tiến trình đơn hàng</p>
                    {(["pending","preparing","shipping","completed"] as OrderStatus[]).map((s) => {
                      const steps: OrderStatus[] = ["pending","preparing","shipping","completed","cancelled"];
                      const done = selOrder.status !== "cancelled" && steps.indexOf(s) <= steps.indexOf(selOrder.status);
                      return (
                        <div key={s} className="flex items-start gap-3 mb-3 last:mb-0">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${done ? "bg-[#C05A2D] text-white" : "bg-muted"}`}>
                            {done ? <Check size={13} /> : <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />}
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>{ORDER_STATUS[s].label}</p>
                            {done && <p className="text-xs text-muted-foreground">{selOrder.date}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Side */}
                <div className="space-y-4">
                  <div className="bg-card border border-border rounded-xl p-5">
                    <p className="text-sm font-semibold mb-3">Thông tin khách hàng</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2"><User size={14} className="text-muted-foreground" />{selOrder.customer}</div>
                      <div className="flex items-center gap-2"><MessageCircle size={14} className="text-muted-foreground" />{selOrder.phone}</div>
                    </div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-5">
                    <p className="text-sm font-semibold mb-2">Địa chỉ giao hàng</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{selOrder.address}</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-5">
                    <p className="text-sm font-semibold mb-1">Ngày đặt hàng</p>
                    <p className="text-sm text-muted-foreground">{selOrder.date}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Messages ── */}
          {dv === "messages" && (
            <div>
              <h1 className="font-['Playfair_Display'] text-2xl font-bold mb-5">Tin nhắn với khách</h1>
              <div className="grid grid-cols-3 gap-4 h-[560px]">
                {/* Customer list */}
                <div className="border border-border rounded-xl bg-card flex flex-col overflow-hidden">
                  <div className="p-3 border-b border-border shrink-0">
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input placeholder="Tìm khách hàng..." className="w-full pl-8 pr-3 py-1.5 bg-muted rounded-lg text-xs outline-none" />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {sConvos.map((c) => (
                      <button key={c.id} onClick={() => { setActiveSC(c.id); setSConvos((prev) => prev.map((x) => x.id === c.id ? { ...x, unread:0 } : x)); }} className={`flex items-start gap-3 w-full p-3 hover:bg-muted transition-colors text-left border-b border-border last:border-0 ${activeSC === c.id ? "bg-muted" : ""}`}>
                        <img src={c.avatar} alt={c.customer} className="w-10 h-10 rounded-full object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-sm font-medium truncate">{c.customer}</p>
                            {c.unread > 0 && <span className="w-5 h-5 bg-[#C05A2D] text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">{c.unread}</span>}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{c.messages.at(-1)?.text}</p>
                          {c.relatedProduct && <p className="text-[10px] text-[#C05A2D] mt-0.5 truncate">📦 {c.relatedProduct}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat */}
                <div className="col-span-2 border border-border rounded-xl bg-card flex flex-col overflow-hidden">
                  {curSC ? (
                    <>
                      <div className="flex items-center justify-between p-3.5 border-b border-border shrink-0">
                        <div className="flex items-center gap-3">
                          <img src={curSC.avatar} alt={curSC.customer} className="w-9 h-9 rounded-full object-cover" />
                          <div>
                            <p className="text-sm font-medium">{curSC.customer}</p>
                            {curSC.relatedProduct && <p className="text-xs text-[#C05A2D]">📦 {curSC.relatedProduct}</p>}
                          </div>
                        </div>
                        <span className="text-xs text-green-500 font-medium">● Online</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {curSC.messages.map((m) => (
                          <div key={m.id} className={`flex ${m.from === "seller" ? "justify-end" : "justify-start"}`}>
                            {m.from === "customer" && <img src={curSC.avatar} alt="" className="w-7 h-7 rounded-full object-cover mr-2 mt-auto shrink-0" />}
                            <div className={`max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm ${m.from === "seller" ? "bg-[#C05A2D] text-white rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                              <p>{m.text}</p>
                              <div className="flex items-center justify-end gap-1 mt-1">
                                <p className={`text-[10px] ${m.from === "seller" ? "text-white/60" : "text-muted-foreground"}`}>{m.time}</p>
                                {m.from === "seller" && <Check size={10} className="text-white/60" />}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div ref={smEndRef} />
                      </div>
                      <div className="p-3 border-t border-border flex gap-2 shrink-0">
                        <input value={smInput} onChange={(e) => setSmInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendSellerMsg()} placeholder="Nhắn tin cho khách..." className="flex-1 px-4 py-2 bg-muted rounded-full text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
                        <button onClick={sendSellerMsg} className="w-9 h-9 bg-[#C05A2D] text-white rounded-full flex items-center justify-center hover:bg-[#A84D25] transition-colors shrink-0"><Send size={15} /></button>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                      <div className="text-center"><MessageCircle size={40} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Chọn một cuộc trò chuyện</p></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Reviews ── */}
          {dv === "reviews" && (
            <div>
              <h1 className="font-['Playfair_Display'] text-2xl font-bold mb-5">Đánh giá shop</h1>

              {/* Summary */}
              <div className="flex items-center gap-8 bg-card border border-border rounded-xl p-5 mb-6">
                <div className="text-center shrink-0">
                  <p className="text-5xl font-bold text-[#C05A2D] font-['Playfair_Display']">{avgRating}</p>
                  <div className="flex gap-0.5 justify-center mt-1">
                    {[1,2,3,4,5].map((s) => <Star key={s} size={14} className={parseFloat(avgRating) >= s ? "fill-[#C05A2D] text-[#C05A2D]" : "text-muted-foreground"} />)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{reviews.length} đánh giá</p>
                </div>
                <div className="flex-1">
                  {[5,4,3,2,1].map((star) => {
                    const cnt = reviews.filter((r) => r.rating === star).length;
                    return (
                      <div key={star} className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-muted-foreground w-3">{star}</span>
                        <Star size={10} className="fill-[#C05A2D] text-[#C05A2D] shrink-0" />
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-[#C05A2D] rounded-full transition-all" style={{ width: reviews.length ? `${(cnt / reviews.length) * 100}%` : "0%" }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-4">{cnt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* List */}
              <div className="space-y-4">
                {reviews.map((rv) => (
                  <div key={rv.id} className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <img src={rv.avatar} alt={rv.customer} className="w-10 h-10 rounded-full object-cover shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{rv.customer}</p>
                          <span className="text-xs text-muted-foreground">{rv.date}</span>
                        </div>
                        <div className="flex gap-0.5 mt-0.5">{[1,2,3,4,5].map((s) => <Star key={s} size={12} className={rv.rating >= s ? "fill-[#C05A2D] text-[#C05A2D]" : "text-muted-foreground"} />)}</div>
                        <p className="text-xs text-[#C05A2D] mt-0.5">📦 {rv.product}</p>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed mb-3">{rv.content}</p>
                    {rv.reply
                      ? <div className="bg-secondary/60 rounded-xl p-3 ml-4">
                          <p className="text-xs font-semibold text-[#C05A2D] mb-1">Phản hồi của shop:</p>
                          <p className="text-sm">{rv.reply}</p>
                        </div>
                      : <div className="flex gap-2 ml-4">
                          <input value={replyMap[rv.id] || ""} onChange={(e) => setReplyMap((prev) => ({ ...prev, [rv.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && submitReply(rv.id)} placeholder="Phản hồi khách hàng..." className="flex-1 px-3.5 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
                          <button onClick={() => submitReply(rv.id)} className="px-4 py-2 bg-[#C05A2D] text-white text-sm rounded-lg hover:bg-[#A84D25] transition-colors">Gửi</button>
                        </div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Edit Shop ── */}
          {dv === "edit-shop" && (
            <div>
              <h1 className="font-['Playfair_Display'] text-2xl font-bold mb-6">Chỉnh sửa hồ sơ shop</h1>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-5">
                  {/* Banner + Avatar */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="relative h-36 bg-secondary cursor-pointer group">
                      <img src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=900&h=200&fit=crop&auto=format" alt="Banner" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="flex items-center gap-2 bg-white/90 px-4 py-2 rounded-full text-sm font-medium"><Camera size={14} /> Thay đổi banner</span>
                      </div>
                    </div>
                    <div className="px-5 pb-5 -mt-8 flex items-end gap-4">
                      <div className="relative w-20 h-20 rounded-2xl border-4 border-card bg-[#C05A2D] flex items-center justify-center text-white text-2xl font-bold font-['Playfair_Display'] cursor-pointer group overflow-hidden shadow-md shrink-0">
                        {editForm.name[0] || shopName[0]}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Camera size={16} className="text-white" /></div>
                      </div>
                      <p className="text-xs text-muted-foreground pb-1">Nhấn vào ảnh để thay đổi</p>
                    </div>
                  </div>

                  {/* Basic info */}
                  <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <p className="text-sm font-semibold">Thông tin cơ bản</p>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Tên shop *</label>
                      <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Mô tả shop</label>
                      <textarea value={editForm.desc} onChange={(e) => setEditForm({ ...editForm, desc: e.target.value })} rows={3} placeholder="Mô tả ngắn về shop của bạn..." className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30 resize-none" />
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <p className="text-sm font-semibold">Thông tin liên hệ</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Số điện thoại</label>
                        <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Email</label>
                        <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Địa chỉ shop</label>
                      <input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="Địa chỉ kho hàng / showroom" className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <div className="bg-card border border-border rounded-xl p-5 sticky top-6">
                    <p className="text-sm font-semibold mb-4">Xem trước</p>
                    <div className="bg-secondary/40 rounded-xl p-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-[#C05A2D] flex items-center justify-center text-white text-xl font-bold font-['Playfair_Display'] mb-2">{editForm.name[0] || "S"}</div>
                      <p className="text-sm font-semibold">{editForm.name || "Tên shop"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{editForm.desc || "Mô tả shop của bạn"}</p>
                      {editForm.phone && <p className="text-xs text-muted-foreground mt-1.5">📞 {editForm.phone}</p>}
                      {editForm.address && <p className="text-xs text-muted-foreground">📍 {editForm.address}</p>}
                    </div>
                    <button onClick={() => { setShopForm({ name: editForm.name, desc: editForm.desc, phone: editForm.phone, address: editForm.address }); setDv("shop-profile"); }} className="w-full py-2.5 bg-[#C05A2D] text-white rounded-xl text-sm font-medium hover:bg-[#A84D25] transition-colors">
                      Lưu thay đổi
                    </button>
                    <button onClick={() => setDv("shop-profile")} className="w-full mt-2 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">Hủy</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Shop Profile (seller view) ── */}
          {dv === "shop-profile" && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h1 className="font-['Playfair_Display'] text-2xl font-bold">Hồ sơ shop</h1>
                <button onClick={() => setDv("edit-shop")} className="flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium rounded-full hover:bg-muted transition-colors">
                  <Edit3 size={14} /> Chỉnh sửa
                </button>
              </div>

              {/* Banner + info */}
              <div className="bg-card border border-border rounded-xl overflow-hidden mb-5">
                <div className="relative h-40 bg-secondary">
                  <img src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=900&h=200&fit=crop&auto=format" alt="Banner" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
                <div className="px-6 pb-5">
                  <div className="relative z-10 flex items-end gap-4 mb-4">
                    <div className="w-20 h-20 rounded-2xl border-4 border-card bg-[#C05A2D] flex items-center justify-center text-white text-3xl font-bold font-['Playfair_Display'] shrink-0 shadow-lg -mt-10">
                      {shopName[0]}
                    </div>
                    <div className="pb-1">
                      <h2 className="font-['Playfair_Display'] text-xl font-bold">{shopName}</h2>
                      <p className="text-sm text-muted-foreground">{shopForm.desc || "Chưa có mô tả — hãy chỉnh sửa để thu hút khách hàng"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 pt-4 border-t border-border">
                    {[["Sản phẩm", active], ["Đã bán", managed.reduce((a,p) => a + p.sold, 0).toLocaleString()], ["Hoàn thành", orders.filter((o) => o.status === "completed").length], ["Đánh giá", avgRating + " ★"]].map(([l, v]) => (
                      <div key={String(l)} className="text-center">
                        <p className="text-lg font-bold">{v}</p>
                        <p className="text-xs text-muted-foreground">{l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {shopForm.phone || shopForm.address
                ? <div className="bg-card border border-border rounded-xl p-5">
                    <p className="text-sm font-semibold mb-3">Thông tin liên hệ</p>
                    {shopForm.phone   && <p className="text-sm text-muted-foreground mb-1">📞 {shopForm.phone}</p>}
                    {shopForm.address && <p className="text-sm text-muted-foreground">📍 {shopForm.address}</p>}
                  </div>
                : <div className="bg-card border border-border border-dashed rounded-xl p-6 text-center text-muted-foreground">
                    <p className="text-sm">Chưa có thông tin liên hệ</p>
                    <button onClick={() => setDv("edit-shop")} className="mt-2 text-sm text-[#C05A2D] hover:underline">Thêm ngay</button>
                  </div>}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView]           = useState<View>("home");
  const [selProd, setSelProd]     = useState<Product | null>(null);
  const [cart, setCart]           = useState<CartItem[]>([]);
  const [user, setUser]           = useState<AppUser | null>(null);
  const [showAuth, setShowAuth]   = useState(false);
  const [authMode, setAuthMode]   = useState<AuthMode>("login");
  const [authForm, setAuthForm]   = useState({ name:"", email:"", password:"" });
  const [searchQ, setSearchQ]     = useState("");
  const [searchIn, setSearchIn]   = useState("");
  const [liked, setLiked]         = useState<string[]>([]);
  const [buyConvos, setBuyConvos] = useState<BuyerConvo[]>(INIT_BUYER_CONVOS);
  const [activeBC, setActiveBC]   = useState<string | null>(null);
  const [msgIn, setMsgIn]         = useState("");
  const [selSize, setSelSize]     = useState("");
  const [selColor, setSelColor]   = useState("");
  const [checkout, setCheckout]   = useState<CheckoutStep>("bag");
  const [category, setCategory]   = useState("Tất cả");
  const [shopForm, setShopForm]   = useState<ShopForm>({ name:"", desc:"", phone:"", address:"" });
  const [showMenu, setShowMenu]   = useState(false);
  const [payForm, setPayForm]     = useState({ name:"", phone:"", address:"", method:"cod" });
  const [extraP, setExtraP]       = useState<Product[]>([]);
  const [viewShop, setViewShop]   = useState<string | null>(null);

  const msgEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { msgEnd.current?.scrollIntoView({ behavior:"smooth" }); }, [activeBC, buyConvos]);

  const allProducts  = [...BASE_PRODUCTS, ...extraP];
  const cartCount    = cart.reduce((a, c) => a + c.quantity, 0);
  const cartTotal    = cart.reduce((a, c) => a + c.product.price * c.quantity, 0);
  const totalUnread  = buyConvos.reduce((a, c) => a + c.unread, 0);
  const filtered     = allProducts.filter((p) => category === "Tất cả" || p.category === category);
  const recommended  = allProducts.filter((p) => liked.some((id) => { const lp = allProducts.find((x) => x.id === id); return lp && (lp.category === p.category || lp.shopId === p.shopId) && p.id !== id; })).slice(0, 4);

  const toggleLike   = (id: string) => setLiked((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const openProduct  = (p: Product) => { setSelProd(p); setSelSize(""); setSelColor(""); setView("product"); };
  const openShop     = (sid: string) => { setViewShop(sid); setView("shop-profile"); };
  const openConvo    = (shopId: string, name: string) => {
    if (!user) { setShowAuth(true); return; }
    if (!buyConvos.find((c) => c.shopId === shopId)) setBuyConvos((prev) => [...prev, { shopId, shopName:name, shopAvatar: SHOP_AVATARS[shopId] || SHOP_AVATARS.s1, messages:[], unread:0 }]);
    setBuyConvos((prev) => prev.map((c) => c.shopId === shopId ? { ...c, unread:0 } : c));
    setActiveBC(shopId); setView("messages");
  };
  const openMessages = () => { if (!user) { setShowAuth(true); return; } setActiveBC(buyConvos[0]?.shopId ?? null); setView("messages"); };
  const addToCart    = () => {
    if (!selProd || !selSize || !selColor) return;
    setCart((prev) => { const ex = prev.find((i) => i.product.id === selProd.id && i.size === selSize && i.color === selColor); return ex ? prev.map((i) => i === ex ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { product: selProd, quantity:1, size: selSize, color: selColor }]; });
    setView("cart"); setCheckout("bag");
  };
  const updateQty    = (idx: number, d: number) => setCart((prev) => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, item.quantity + d) } : item));
  const removeItem   = (idx: number) => setCart((prev) => prev.filter((_, i) => i !== idx));
  const sendMsg      = () => {
    if (!msgIn.trim() || !activeBC) return;
    const t = new Date().toLocaleTimeString("vi-VN", { hour:"2-digit", minute:"2-digit" });
    setBuyConvos((prev) => prev.map((c) => c.shopId === activeBC ? { ...c, messages:[...c.messages, { id: Date.now().toString(), from:"user", text: msgIn.trim(), time: t }] } : c));
    setMsgIn("");
    setTimeout(() => { const r: BuyerMsg = { id:(Date.now()+1).toString(), from:"shop", text:"Cảm ơn bạn! Shop sẽ trả lời sớm nhất 🌸", time: new Date().toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}) }; setBuyConvos((prev) => prev.map((c) => c.shopId === activeBC ? { ...c, messages:[...c.messages, r] } : c)); }, 1000);
  };
  const doLogin = () => { setUser({ id:"u1", name: authForm.name || "Nguyễn Mai Anh", email: authForm.email || "maianh@email.com", hasShop:false }); setShowAuth(false); setAuthForm({ name:"", email:"", password:"" }); };

  // ── Full-screen seller dashboard ──
  if (view === "seller-dashboard" && user?.hasShop) {
    return <SellerDashboard user={user} allProducts={allProducts} extraProducts={extraP} setExtraProducts={setExtraP} shopForm={shopForm} setShopForm={setShopForm} onBack={() => setView("home")} />;
  }

  const curBC = buyConvos.find((c) => c.shopId === activeBC);

  return (
    <div className="min-h-screen bg-background font-['DM_Sans']" onClick={() => showMenu && setShowMenu(false)}>

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-secondary p-6 text-center relative">
              <button onClick={() => setShowAuth(false)} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted transition-colors"><X size={15} className="text-muted-foreground" /></button>
              <p className="font-['Playfair_Display'] text-2xl font-semibold">VẢI</p>
              <p className="text-sm text-muted-foreground mt-1">Thời trang Việt Nam</p>
            </div>
            <div className="p-6">
              <div className="flex rounded-lg bg-muted p-0.5 mb-5">
                {(["login","register"] as AuthMode[]).map((m) => (
                  <button key={m} onClick={() => setAuthMode(m)} className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${authMode === m ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>{m === "login" ? "Đăng nhập" : "Đăng ký"}</button>
                ))}
              </div>
              {authMode === "register" && <input placeholder="Họ và tên" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} className="w-full mb-3 px-3.5 py-2.5 bg-muted rounded-lg text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />}
              <input placeholder="Email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} className="w-full mb-3 px-3.5 py-2.5 bg-muted rounded-lg text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
              <input type="password" placeholder="Mật khẩu" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} className="w-full mb-4 px-3.5 py-2.5 bg-muted rounded-lg text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
              <button onClick={doLogin} className="w-full py-2.5 bg-[#C05A2D] text-white rounded-lg text-sm font-medium hover:bg-[#A84D25] transition-colors">{authMode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center h-14 gap-3">
            <button onClick={() => setView("home")} className="font-['Playfair_Display'] text-xl font-bold tracking-wider mr-2 shrink-0">VẢI</button>
            <div className="flex-1 relative max-w-lg">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={searchIn} onChange={(e) => setSearchIn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && searchIn.trim()) { setSearchQ(searchIn.trim()); setCategory("Tất cả"); setView("search"); } }} placeholder="Tìm áo, váy, quần..." className="w-full pl-9 pr-4 py-1.5 bg-secondary rounded-full text-sm outline-none focus:ring-2 ring-[#C05A2D]/30 placeholder:text-muted-foreground" />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={openMessages} className="relative p-2 rounded-full hover:bg-secondary transition-colors">
                <MessageCircle size={20} />
                {totalUnread > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-[#C05A2D] text-white text-[9px] font-bold rounded-full flex items-center justify-center">{totalUnread}</span>}
              </button>
              <button onClick={() => { setView("cart"); setCheckout("bag"); }} className="relative p-2 rounded-full hover:bg-secondary transition-colors">
                <ShoppingBag size={20} />
                {cartCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-[#C05A2D] text-white text-[9px] font-bold rounded-full flex items-center justify-center">{cartCount}</span>}
              </button>
              {user ? (
                <div className="relative">
                  <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full hover:bg-secondary transition-colors">
                    <div className="w-7 h-7 rounded-full bg-[#C05A2D] flex items-center justify-center text-white text-xs font-semibold">{user.name[0]}</div>
                    <ChevronDown size={12} className="text-muted-foreground" />
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 mt-1 w-52 bg-card rounded-xl shadow-lg border border-border py-1 z-50">
                      <div className="px-3 py-2 border-b border-border">
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      {!user.hasShop
                        ? <button onClick={() => { setView("shop-register"); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors"><Store size={14} /> Mở shop của bạn</button>
                        : <>
                            <button onClick={() => { setView("seller-dashboard"); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors"><BarChart2 size={14} /> Quản lý shop</button>
                            <button onClick={() => { openShop(user.shopId!); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors"><Store size={14} /> Trang shop của tôi</button>
                          </>}
                      <button onClick={() => { setUser(null); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"><LogOut size={14} /> Đăng xuất</button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => setShowAuth(true)} className="px-3.5 py-1.5 bg-[#C05A2D] text-white rounded-full text-sm font-medium hover:bg-[#A84D25] transition-colors">Đăng nhập</button>
              )}
            </div>
          </div>
        </div>
      </header>

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
          const res = allProducts.filter((p) => p.name.toLowerCase().includes(searchQ.toLowerCase()) || p.shopName.toLowerCase().includes(searchQ.toLowerCase()) || p.tags.some((t) => t.toLowerCase().includes(searchQ.toLowerCase())));
          return (
            <div className="max-w-6xl mx-auto px-4 py-6">
              <div className="flex items-center gap-3 mb-5">
                <button onClick={() => setView("home")} className="p-1.5 hover:bg-secondary rounded-full transition-colors"><ArrowLeft size={18} /></button>
                <h2 className="font-['Playfair_Display'] text-lg font-semibold">Kết quả cho "{searchQ}"</h2>
                <span className="text-sm text-muted-foreground ml-auto">{res.length} sản phẩm</span>
              </div>
              {res.length === 0
                ? <div className="text-center py-20 text-muted-foreground"><Search size={40} className="mx-auto mb-3 opacity-30" /><p className="font-medium">Không tìm thấy sản phẩm</p></div>
                : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{res.map((p) => <ProductCard key={p.id} product={p} liked={liked.includes(p.id)} onLike={toggleLike} onClick={openProduct} />)}</div>}
            </div>
          );
        })()}

        {/* ── Product Detail ── */}
        {view === "product" && selProd && (() => {
          const p = selProd; const canAdd = selSize && selColor;
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
                  <button onClick={() => openShop(p.shopId)} className="flex items-center gap-2 mb-2 hover:opacity-70 transition-opacity">
                    <img src={SHOP_AVATARS[p.shopId] || SHOP_AVATARS.s1} alt={p.shopName} className="w-7 h-7 rounded-full object-cover" />
                    <span className="text-sm text-muted-foreground hover:underline underline-offset-2">{p.shopName}</span>
                  </button>
                  <h1 className="font-['Playfair_Display'] text-2xl font-semibold mb-3">{p.name}</h1>
                  <div className="flex items-center gap-3 mb-4"><StarRow rating={p.rating} reviews={p.reviews} /><span className="text-xs text-muted-foreground">· Đã bán {p.sold.toLocaleString()}</span></div>
                  <div className="flex items-baseline gap-3 mb-5">
                    <span className="text-2xl font-bold text-[#C05A2D]">{fmt(p.price)}</span>
                    {p.originalPrice && <span className="text-base text-muted-foreground line-through">{fmt(p.originalPrice)}</span>}
                  </div>
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Kích thước {selSize && <span className="text-[#C05A2D]">— {selSize}</span>}</p>
                    <div className="flex flex-wrap gap-2">{p.sizes.map((s) => <button key={s} onClick={() => setSelSize(s)} className={`px-3.5 py-1.5 rounded-lg text-sm border transition-all ${selSize === s ? "border-[#C05A2D] bg-[#C05A2D]/10 text-[#C05A2D] font-medium" : "border-border hover:border-foreground/40"}`}>{s}</button>)}</div>
                  </div>
                  <div className="mb-5">
                    <p className="text-sm font-medium mb-2">Màu sắc {selColor && <span className="text-[#C05A2D]">— {selColor}</span>}</p>
                    <div className="flex flex-wrap gap-2">{p.colors.map((c) => <button key={c} onClick={() => setSelColor(c)} className={`px-3.5 py-1.5 rounded-lg text-sm border transition-all ${selColor === c ? "border-[#C05A2D] bg-[#C05A2D]/10 text-[#C05A2D] font-medium" : "border-border hover:border-foreground/40"}`}>{c}</button>)}</div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">{p.description}</p>
                  <div className="flex gap-3">
                    <button onClick={addToCart} disabled={!canAdd} className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${canAdd ? "bg-[#C05A2D] text-white hover:bg-[#A84D25] shadow-sm" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>{canAdd ? "Thêm vào giỏ hàng" : "Chọn size và màu"}</button>
                    <button onClick={() => openConvo(p.shopId, p.shopName)} className="px-4 py-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors flex items-center gap-2"><MessageCircle size={15} /> Chat</button>
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
            <div className="max-w-md mx-auto px-4 py-20 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5"><Check size={36} className="text-green-600" /></div>
              <h2 className="font-['Playfair_Display'] text-2xl font-semibold mb-2">Đặt hàng thành công!</h2>
              <p className="text-muted-foreground mb-8">Đơn hàng sẽ được giao trong 2-4 ngày làm việc 🌸</p>
              <button onClick={() => { setCart([]); setCheckout("bag"); setView("home"); }} className="px-6 py-2.5 bg-[#C05A2D] text-white rounded-full text-sm font-medium hover:bg-[#A84D25] transition-colors">Tiếp tục mua sắm</button>
            </div>
          );
          if (checkout === "payment") return (
            <div className="max-w-lg mx-auto px-4 py-6">
              <button onClick={() => setCheckout("bag")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"><ArrowLeft size={15} /> Giỏ hàng</button>
              <h2 className="font-['Playfair_Display'] text-xl font-semibold mb-6">Thông tin giao hàng</h2>
              <div className="space-y-3 mb-5">
                <input placeholder="Họ và tên" value={payForm.name} onChange={(e) => setPayForm({ ...payForm, name: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
                <input placeholder="Số điện thoại" value={payForm.phone} onChange={(e) => setPayForm({ ...payForm, phone: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
                <textarea placeholder="Địa chỉ giao hàng" value={payForm.address} onChange={(e) => setPayForm({ ...payForm, address: e.target.value })} rows={2} className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30 resize-none" />
              </div>
              <p className="text-sm font-medium mb-3">Phương thức thanh toán</p>
              <div className="space-y-2 mb-6">
                {[["cod","Thanh toán khi nhận hàng (COD)"],["transfer","Chuyển khoản ngân hàng"],["momo","Ví MoMo"]].map(([val,label]) => (
                  <button key={val} onClick={() => setPayForm({ ...payForm, method: val })} className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-sm transition-all ${payForm.method === val ? "border-[#C05A2D] bg-[#C05A2D]/5" : "border-border hover:border-foreground/30"}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${payForm.method === val ? "border-[#C05A2D]" : "border-muted-foreground"}`}>{payForm.method === val && <div className="w-2 h-2 rounded-full bg-[#C05A2D]" />}</div>{label}
                  </button>
                ))}
              </div>
              <div className="bg-secondary rounded-xl p-4 mb-5">
                <div className="flex justify-between text-sm mb-1.5"><span className="text-muted-foreground">Tạm tính</span><span>{fmt(cartTotal)}</span></div>
                <div className="flex justify-between text-sm mb-3"><span className="text-muted-foreground">Vận chuyển</span><span className="text-green-600">Miễn phí</span></div>
                <div className="flex justify-between font-semibold"><span>Tổng cộng</span><span className="text-[#C05A2D] text-lg">{fmt(cartTotal)}</span></div>
              </div>
              <button onClick={() => setCheckout("success")} className="w-full py-3 bg-[#C05A2D] text-white rounded-xl text-sm font-medium hover:bg-[#A84D25] transition-colors">Đặt hàng — {fmt(cartTotal)}</button>
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
                        <div key={idx} className="flex gap-4 bg-card p-4 rounded-xl border border-border">
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
                          {cart.map((item, idx) => <div key={idx} className="flex justify-between text-sm"><span className="text-muted-foreground line-clamp-1 flex-1 mr-2">{item.product.name} ×{item.quantity}</span><span className="shrink-0">{fmt(item.product.price * item.quantity)}</span></div>)}
                        </div>
                        <div className="border-t border-border pt-3 mb-4">
                          <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">Vận chuyển</span><span className="text-green-600 font-medium">Miễn phí</span></div>
                          <div className="flex justify-between font-semibold mt-2"><span>Tổng cộng</span><span className="text-[#C05A2D]">{fmt(cartTotal)}</span></div>
                        </div>
                        <button onClick={() => { if (!user) { setShowAuth(true); return; } setCheckout("payment"); }} className="w-full py-3 bg-[#C05A2D] text-white rounded-xl text-sm font-medium hover:bg-[#A84D25] transition-colors">Tiến hành thanh toán</button>
                      </div>
                    </div>
                  </div>}
            </div>
          );
        })()}

        {/* ── Messages (buyer) ── */}
        {view === "messages" && (
          <div className="max-w-5xl mx-auto px-4 py-6">
            <h2 className="font-['Playfair_Display'] text-xl font-semibold mb-5">Tin nhắn</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[520px]">
              <div className="border border-border rounded-xl bg-card flex flex-col overflow-hidden">
                <div className="p-3 border-b border-border shrink-0"><div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input placeholder="Tìm trò chuyện..." className="w-full pl-8 pr-3 py-1.5 bg-muted rounded-lg text-xs outline-none" /></div></div>
                <div className="overflow-y-auto flex-1">
                  {buyConvos.map((c) => (
                    <button key={c.shopId} onClick={() => { setBuyConvos((prev) => prev.map((x) => x.shopId === c.shopId ? { ...x, unread:0 } : x)); setActiveBC(c.shopId); }} className={`flex items-center gap-3 w-full p-3 hover:bg-muted transition-colors text-left border-b border-border last:border-0 ${activeBC === c.shopId ? "bg-muted" : ""}`}>
                      <img src={c.shopAvatar} alt={c.shopName} className="w-10 h-10 rounded-full object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between"><p className="text-sm font-medium truncate">{c.shopName}</p>{c.unread > 0 && <span className="w-5 h-5 bg-[#C05A2D] text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">{c.unread}</span>}</div>
                        <p className="text-xs text-muted-foreground truncate">{c.messages.at(-1)?.text || "Bắt đầu trò chuyện"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2 border border-border rounded-xl bg-card flex flex-col overflow-hidden">
                {curBC ? (
                  <>
                    <div className="flex items-center gap-3 p-3.5 border-b border-border shrink-0">
                      <img src={curBC.shopAvatar} alt={curBC.shopName} className="w-9 h-9 rounded-full object-cover" />
                      <div><p className="text-sm font-medium">{curBC.shopName}</p><p className="text-xs text-green-500">Đang hoạt động</p></div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {curBC.messages.map((m) => (
                        <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                          {m.from === "shop" && <img src={curBC.shopAvatar} alt="" className="w-7 h-7 rounded-full object-cover mr-2 mt-auto shrink-0" />}
                          <div className={`max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm ${m.from === "user" ? "bg-[#C05A2D] text-white rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                            <p>{m.text}</p>
                            <p className={`text-[10px] mt-1 ${m.from === "user" ? "text-white/60" : "text-muted-foreground"}`}>{m.time}</p>
                          </div>
                        </div>
                      ))}
                      <div ref={msgEnd} />
                    </div>
                    <div className="p-3 border-t border-border flex gap-2 shrink-0">
                      <input value={msgIn} onChange={(e) => setMsgIn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMsg()} placeholder="Nhắn tin cho shop..." className="flex-1 px-4 py-2 bg-muted rounded-full text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />
                      <button onClick={sendMsg} className="w-9 h-9 bg-[#C05A2D] text-white rounded-full flex items-center justify-center hover:bg-[#A84D25] transition-colors shrink-0"><Send size={15} /></button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground"><div className="text-center"><MessageCircle size={40} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Chọn một cuộc trò chuyện</p></div></div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Shop Register ── */}
        {view === "shop-register" && (
          <div className="max-w-lg mx-auto px-4 py-6">
            <button onClick={() => setView("home")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"><ArrowLeft size={15} /> Quay lại</button>
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-[#C05A2D]/10 rounded-2xl flex items-center justify-center mx-auto mb-3"><Store size={24} className="text-[#C05A2D]" /></div>
                <h2 className="font-['Playfair_Display'] text-xl font-semibold">Mở shop của bạn</h2>
                <p className="text-sm text-muted-foreground mt-1">Bắt đầu bán hàng trên VẢI ngay hôm nay</p>
              </div>
              <div className="space-y-3 mb-5">
                {[{ k:"name", l:"Tên shop *", p:"VD: Bông Studio" },{ k:"desc", l:"Mô tả shop *", p:"Phong cách thời trang...", ta:true },{ k:"phone", l:"Số điện thoại *", p:"0901 234 567" },{ k:"address", l:"Địa chỉ kho hàng", p:"Địa chỉ lấy hàng" }].map(({ k,l,p,ta }) => (
                  <div key={k}>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">{l}</label>
                    {ta
                      ? <textarea placeholder={p} value={(shopForm as any)[k]} onChange={(e) => setShopForm({ ...shopForm, [k]: e.target.value })} rows={2} className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30 resize-none" />
                      : <input placeholder={p} value={(shopForm as any)[k]} onChange={(e) => setShopForm({ ...shopForm, [k]: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-2 ring-[#C05A2D]/30" />}
                  </div>
                ))}
              </div>
              <button
                onClick={() => { if (!shopForm.name || !shopForm.desc || !shopForm.phone) return; if (!user) { setShowAuth(true); return; } setUser({ ...user, hasShop:true, shopId:"s_new" }); setView("seller-dashboard"); }}
                disabled={!shopForm.name || !shopForm.desc || !shopForm.phone}
                className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${shopForm.name && shopForm.desc && shopForm.phone ? "bg-[#C05A2D] text-white hover:bg-[#A84D25]" : "bg-muted text-muted-foreground cursor-not-allowed"}`}
              >
                Đăng ký mở shop
              </button>
            </div>
          </div>
        )}

        {/* ── Shop Profile (buyer) ── */}
        {view === "shop-profile" && viewShop && (
          <ShopProfileView sid={viewShop} allProducts={allProducts} user={user} shopForm={shopForm} liked={liked} toggleLike={toggleLike} openProduct={openProduct} openConvo={openConvo} goBack={() => setView("home")} goSell={() => setView("seller-dashboard")} />
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border flex md:hidden z-30">
        {[
          { label:"Trang chủ", icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>, action:() => setView("home"), active: view === "home" },
          { label:"Tìm kiếm", icon:<Search size={20} />, action:() => { setView("search"); setSearchQ(""); }, active: view === "search" },
          { label:"Giỏ hàng", icon:<ShoppingBag size={20} />, action:() => { setView("cart"); setCheckout("bag"); }, active: view === "cart", badge: cartCount },
          { label:"Tin nhắn",  icon:<MessageCircle size={20} />, action: openMessages, active: view === "messages", badge: totalUnread },
          { label:"Tài khoản", icon:<User size={20} />, action:() => user ? setShowMenu(true) : setShowAuth(true), active:false },
        ].map((item) => (
          <button key={item.label} onClick={item.action} className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${item.active ? "text-[#C05A2D]" : "text-muted-foreground hover:text-foreground"}`}>
            <span className="relative">
              {item.icon}
              {item.badge ? <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#C05A2D] text-white text-[9px] font-bold rounded-full flex items-center justify-center">{item.badge}</span> : null}
            </span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
