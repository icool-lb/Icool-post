import "./globals.css";

export const metadata = {
  title: "iCOOL Photo Branding",
  description: "Realistic photo enhancement, exact iCOOL logo, footer and smart slogans.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "iCOOL Photos",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
