import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PT Product Page Content",
  description: "Product page content management for Penelope Tom",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {process.env.NEXT_PUBLIC_SHOPIFY_API_KEY && (
          <script
            src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
            data-api-key={process.env.NEXT_PUBLIC_SHOPIFY_API_KEY}
          />
        )}
      </head>
      <body className="bg-gray-50 min-h-screen antialiased text-sm">
        {children}
      </body>
    </html>
  );
}
