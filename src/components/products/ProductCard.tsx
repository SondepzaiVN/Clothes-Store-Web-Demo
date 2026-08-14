import { Heart } from "lucide-react";
import type { Product } from "../../types";
import { discountPercent, formatCurrency } from "../../utils/format";
import { RatingRow } from "./RatingRow";

interface ProductCardProps {
  product: Product;
  liked: boolean;
  onLike: (id: string) => void;
  onClick: (product: Product) => void;
}

export function ProductCard({ product, liked, onLike, onClick }: ProductCardProps) {
  return (
    <article
      className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-shadow duration-300 hover:shadow-lg"
      onClick={() => onClick(product)}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {product.originalPrice && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[#C05A2D] px-2 py-0.5 text-[10px] font-semibold text-white">
            -{discountPercent(product.originalPrice, product.price)}%
          </span>
        )}
        <button
          type="button"
          aria-label={liked ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
          onClick={(event) => {
            event.stopPropagation();
            onLike(product.id);
          }}
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm transition-colors hover:bg-white"
        >
          <Heart
            size={15}
            className={liked ? "fill-[#C05A2D] text-[#C05A2D]" : "text-muted-foreground"}
          />
        </button>
      </div>
      <div className="p-3">
        <p className="mb-0.5 text-[11px] text-muted-foreground">{product.shopName}</p>
        <h3 className="mb-2 line-clamp-2 text-sm font-medium leading-snug">{product.name}</h3>
        <RatingRow rating={product.rating} reviews={product.reviews} />
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-sm font-semibold text-[#C05A2D]">
            {formatCurrency(product.price)}
          </span>
          {product.originalPrice && (
            <span className="text-xs text-muted-foreground line-through">
              {formatCurrency(product.originalPrice)}
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Đã bán {product.sold.toLocaleString("vi-VN")}
        </p>
      </div>
    </article>
  );
}
