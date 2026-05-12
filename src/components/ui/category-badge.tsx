import { cn } from "@/lib/utils";

export type Category =
  | "Food"
  | "Travel"
  | "Accommodation"
  | "Supplies"
  | "Equipment"
  | "Communication"
  | "Other";

export const CATEGORY_COLORS: Record<Category, string> = {
  Food: "#F97316",
  Travel: "#3B82F6",
  Accommodation: "#A855F7",
  Supplies: "#14B8A6",
  Equipment: "#6B7280",
  Communication: "#6366F1",
  Other: "#64748B",
};

export const CATEGORIES: Category[] = [
  "Food",
  "Travel",
  "Accommodation",
  "Supplies",
  "Equipment",
  "Communication",
  "Other",
];

export function CategoryBadge({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  const color = CATEGORY_COLORS[category];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full text-xs px-2.5 py-0.5 font-medium border",
        className,
      )}
      style={{
        backgroundColor: `${color}1A`,
        color,
        borderColor: `${color}55`,
      }}
    >
      {category}
    </span>
  );
}
