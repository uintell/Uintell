import "./globals.css";

export const metadata = {
  title: "United Intelligence",
  description: "Hybrid search and grounded QA over offline reference and technical documentation"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
