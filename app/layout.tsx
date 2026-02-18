import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Staff Manager",
  description: "Internal staff management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="dark">
      <body className="antialiased bg-gray-950 text-gray-100">
        {children}
      </body>
    </html>
  );
}
