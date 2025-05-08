import type { Metadata } from "next";
import {  } from "next"
import "./globals.css";

export const metadata: Metadata = {
  title: "ytdlder",
  description: "Convenient YouTube downloader",
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
    return (
        <html lang="en">
            <body>
                {children}
            </body>
        </html>
    );
}
