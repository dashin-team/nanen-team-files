import type { Metadata, Viewport } from "next";
import { Noto_Sans_TC, Noto_Serif_TC } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const sans = Noto_Sans_TC({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-noto-sans",
  adjustFontFallback: false,
});

const serif = Noto_Serif_TC({
  weight: ["600", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-noto-serif",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "南恩通訊處 團隊檔案庫",
  description: "富邦人壽南恩通訊處的內部檔案共用。",
  robots: { index: false, follow: false },
  icons: {
    icon: "/brand/logo.png",
    apple: "/brand/logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#12315f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
