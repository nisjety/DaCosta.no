import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const montserrat = Montserrat({ 
  subsets: ["latin"], 
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ima Da Costa | IT-Utvikler",
  description: "IT-utvikler med spesialisering innen backend",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="no" className="scroll-smooth">
      <body className={`${inter.variable} ${montserrat.variable} font-sans bg-white`}>
        {children}
      </body>
    </html>
  );
}