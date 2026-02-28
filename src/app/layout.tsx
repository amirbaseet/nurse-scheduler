import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { I18nProvider } from "@/i18n/provider";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NurseScheduler Pro",
  description: "מערכת שיבוץ אחיות",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} font-sans antialiased`}>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
