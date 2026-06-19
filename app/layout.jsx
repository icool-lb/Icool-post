import "./globals.css";

export const metadata = {
  title: "iCOOL Photo Branding",
  description: "Professional iCOOL photo finishing, branding, footer and slogan.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "iCOOL Photos",
    statusBarStyle: "default",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
