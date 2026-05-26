import type { ProductSummary } from "@/lib/types";

const classifyColors: Record<string, string> = {
  complete: "bg-green-100 text-green-700",
  partial:  "bg-yellow-100 text-yellow-800",
  missing:  "bg-gray-100 text-gray-500",
};
const classifyLabels: Record<string, string> = {
  complete: "Type and Style set",
  partial:  "Part. classified",
  missing:  "No Type/Style set",
};
const contentColors: Record<string, string> = {
  complete: "bg-green-100 text-green-700",
  partial:  "bg-amber-100 text-amber-800",
  missing:  "bg-gray-100 text-gray-500",
};
const contentLabels: Record<string, string> = {
  complete: "Content set",
  partial:  "Partial",
  missing:  "No Content set",
};

interface Props {
  products: ProductSummary[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onLoadMore?: () => void;
}

export default function ProductList({ products, loading, selectedId, onSelect, onLoadMore }: Props) {
  if (loading && products.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  if (!loading && products.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        No products found
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <ul className="divide-y divide-gray-100">
        {products.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onSelect(p.id)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                selectedId === p.id
                  ? "bg-blue-50 border-l-2 border-l-blue-600 pl-[14px]"
                  : ""
              }`}
            >
              {p.featuredImage ? (
                <img src={p.featuredImage} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
              ) : (
                <div className="w-10 h-10 bg-gray-100 rounded shrink-0 border border-gray-200" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-800 text-[13px] leading-snug">{p.title}</div>
                <div className="text-gray-400 text-[11px] truncate mt-0.5">
                  {p.productTypePt || "—"} {p.productStylePt ? `· ${p.productStylePt}` : ""}
                </div>
              </div>
              <div className="flex flex-col gap-0.5 items-end shrink-0">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full tracking-wide ${classifyColors[p.classifyStatus]}`}>
                  {classifyLabels[p.classifyStatus]}
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full tracking-wide ${contentColors[p.contentStatus]}`}>
                  {contentLabels[p.contentStatus]}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {onLoadMore && (
        <div className="p-3">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="w-full py-2 text-xs text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-colors"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
