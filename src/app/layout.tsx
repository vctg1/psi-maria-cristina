import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Maria Cristina Psicóloga",
  description: "Consultório de Psicologia - Atendimento Online e Presencial",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Maria Cristina Psicóloga",
    description: "Consultório de Psicologia - Atendimento Online e Presencial",
    url: "https://psi-maria-cristina.vercel.app",
    siteName: "Maria Cristina Psicóloga",
    images: [
      {
        url: "https://psi-maria-cristina.vercel.app/CristinaVestido.jpeg",
        width: 1200,
        height: 630,
        alt: "Maria Cristina Psicóloga",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Maria Cristina Psicóloga",
    description: "Consultório de Psicologia - Atendimento Online e Presencial",
    images: ["https://psi-maria-cristina.vercel.app/CristinaVestido.jpeg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
