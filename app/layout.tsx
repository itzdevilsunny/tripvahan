import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tripvahan - Two-Sided Trip-Request Marketplace & Cab Partner Connect",
  description:
    "Plan a trip, publish custom requirements, receive verified operator quotations, compare honest prices, and confirm bookings with zero dummy data.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased bg-[#f4f6fa]">
      <body className="min-h-full flex flex-col font-sans selection:bg-teal-100 selection:text-teal-900">
        {children}
      </body>
    </html>
  );
}
