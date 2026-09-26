import type { Metadata } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import "./globals.css";
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import "./tema.css";
import { AuthProvider } from "@/contexts/AuthContext";


const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  display: "swap",
});

const corpo = Nunito_Sans({
  variable: "--font-corpo",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cristinapsi.online"),
  title: "Maria Cristina Psicóloga",
  description:
    "Psicóloga clínica em Planaltina-DF e online. Terapia cognitivo-comportamental para crianças, adolescentes e adultos.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Maria Cristina Psicóloga",
    description:
      "Psicóloga clínica em Planaltina-DF e online. Terapia cognitivo-comportamental para crianças, adolescentes e adultos.",
    url: "/",
    siteName: "Maria Cristina Psicóloga",
    images: [
      {
        url: "/CristinaVestido.jpeg",
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
    description:
      "Psicóloga clínica em Planaltina-DF e online. Terapia cognitivo-comportamental para crianças, adolescentes e adultos.",
    images: ["/CristinaVestido.jpeg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${corpo.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
