import "./globals.css";
import React from "react";

export const metadata = {
  title: "KCS Partner Widget"
};

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en">
    <body className="min-h-screen bg-slate-100 text-slate-900">{children}</body>
  </html>
);

export default RootLayout;

