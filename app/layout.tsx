import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartSaver Sacco",
  description: "Savings, loans, and member finance operations"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
