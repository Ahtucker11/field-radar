import "./globals.css";

export const metadata = {
  title: "Field Radar — Midwest Events",
  description: "Living calendar of high-leverage Midwest startup events.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
