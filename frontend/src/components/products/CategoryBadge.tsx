interface CategoryBadgeProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function CategoryBadge({ label, active, onClick }: CategoryBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
        active
          ? "bg-[#C05A2D] text-white shadow-sm"
          : "bg-secondary text-foreground hover:bg-secondary/70"
      }`}
    >
      {label}
    </button>
  );
}
