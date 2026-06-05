import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { TooltipProvider } from "@/components/Tooltip";
import AppBridgeAuth from "@/components/AppBridgeAuth";

export const metadata: Metadata = {
  title: "PT Product Page Content",
  description: "Product page content management for Penelope Tom",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body className="bg-gray-50 min-h-screen antialiased text-sm">
        {process.env.NEXT_PUBLIC_SHOPIFY_API_KEY && (
          <Script
            src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
            data-api-key={process.env.NEXT_PUBLIC_SHOPIFY_API_KEY}
            strategy="beforeInteractive"
          />
        )}
        <AppBridgeAuth />
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
