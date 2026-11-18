import type { Metadata } from "next";
import { Alexandria, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const alexandria = Alexandria({ variable: "--font-alexandria", subsets: ["arabic", "latin"] });

export const metadata: Metadata = {
  title: "Khisha | خِشّه",
  description: "Khisha is a personal AI memory assistant: save receipts and documents, search them, and ask questions with sources. خِشّه الحين، تلقاه بعدين",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${alexandria.variable}`}>
      <body>{children}</body>
    </html>
  );
}
