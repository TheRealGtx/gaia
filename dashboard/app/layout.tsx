import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gaia · Decentralized Environmental Intelligence",
  description: "Interactive digital twin for decentralized environmental sensor networks.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const themeScript = `(function(){try{var s=localStorage.getItem('gaia-theme');var p=s==='light'||s==='dark'||s==='system'?s:'system';var t=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){}})()`;
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
