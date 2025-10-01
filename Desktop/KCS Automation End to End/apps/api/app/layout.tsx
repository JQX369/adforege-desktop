import React from "react";

export const metadata = {
  title: "KCS API"
};

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en">
    <body>{children}</body>
  </html>
);

export default RootLayout;

