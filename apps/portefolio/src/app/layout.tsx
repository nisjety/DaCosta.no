import type { Metadata } from "next";
import { Inter, Montserrat, Space_Grotesk } from "next/font/google";
import "./globals.css";
import LoadingProvider from "@/components/core/LoadingProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const montserrat = Montserrat({ 
  subsets: ["latin"], 
  variable: "--font-montserrat",
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
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
      <body className={`${inter.variable} ${montserrat.variable} ${spaceGrotesk.variable} font-sans bg-white overflow-x-hidden w-full max-w-[100vw]`}>
        <LoadingProvider>
          <div className="overflow-x-hidden w-full max-w-[100vw]">
            {children}
          </div>
        </LoadingProvider>
      </body>
    </html>
  );
}