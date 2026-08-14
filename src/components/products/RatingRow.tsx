import { Star } from "lucide-react";

interface RatingRowProps {
  rating: number;
  reviews: number;
}

export function RatingRow({ rating, reviews }: RatingRowProps) {
  return (
    <span className="flex items-center gap-1">
      <Star size={12} className="fill-[#C05A2D] text-[#C05A2D]" />
      <span className="text-xs font-medium text-[#C05A2D]">{rating}</span>
      <span className="text-xs text-muted-foreground">({reviews})</span>
    </span>
  );
}
