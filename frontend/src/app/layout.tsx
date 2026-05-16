import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Toaster from "@/components/Toaster";

export const metadata: Metadata = {
  title: "Vintage Bud Threads — Social Publishing",
  description:
    "Social media publishing platform for Vintage Bud Threads — retro Bud Man gear.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-cream min-h-screen">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <Sidebar />

          {/* Main content area */}
          <main
            className="flex-1 min-h-screen overflow-y-auto"
            style={{ marginLeft: "240px" }}
          >
            <div className="min-h-screen bg-cream">{children}</div>
          </main>
        </div>

        <Toaster />
      </body>
    </html>
  );
}
