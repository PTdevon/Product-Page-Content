import Link from "next/link";

const MAIN_LINKS = [
  { href: "/products",    label: "Products",         key: "products" },
  { href: "/bulk",        label: "Bulk Assign",       key: "bulk" },
  { href: "/bulk-review", label: "Bulk Review",       key: "bulk-review" },
  { href: "/library",     label: "Why Choose This",   key: "library" },
  { href: "/library?tab=perfect", label: "Perfect For", key: "perfect-for" },
];

const PF_SUB_LINKS = [
  { href: "/library?tab=perfect",  label: "Phrases",           key: "phrases" },
  { href: "/settings/keywords",    label: "Interest Phrases",   key: "keywords" },
  { href: "/icons",                label: "Icons",              key: "icons" },
  { href: "/settings",             label: "Seasonal Settings",  key: "seasonal" },
];

export default function Nav({ active, subActive }: { active: string; subActive?: string }) {
  return (
    <div className="shrink-0">
      <nav className="bg-white border-b border-gray-200 px-6 flex items-end gap-1">
        <span className="font-semibold text-gray-900 mr-6 pb-3 text-sm">Product Page Content</span>
        {MAIN_LINKS.map(({ href, label, key }) => (
          <Link
            key={key}
            href={href}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active === key
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {active === "perfect-for" && (
        <nav className="bg-gray-50 border-b border-gray-200 px-6 flex items-end gap-1">
          {PF_SUB_LINKS.map(({ href, label, key }) => (
            <Link
              key={key}
              href={href}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                subActive === key
                  ? "border-gray-700 text-gray-800"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
