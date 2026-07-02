import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "文档问答助手",
  description: "基于文档知识库的智能问答工作台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
