import type { Metadata } from "next";
import { ColorSchemeScript, MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";

const theme = createTheme({
  primaryColor: "blue",
  fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  fontFamilyMonospace:
    '"SF Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
  defaultRadius: "md",
  colors: {
    // Map to zinc palette for a consistent dark theme
    dark: [
      "#f4f4f5", // 0 zinc-100
      "#e4e4e7", // 1 zinc-200
      "#d4d4d8", // 2 zinc-300
      "#a1a1aa", // 3 zinc-400
      "#71717a", // 4 zinc-500
      "#52525b", // 5 zinc-600
      "#3f3f46", // 6 zinc-700
      "#27272a", // 7 zinc-800
      "#18181b", // 8 zinc-900
      "#09090b", // 9 zinc-950
    ],
  },
});

export const metadata: Metadata = {
  title: "Remotely — Laptop Control",
  description: "Remote control layer for your laptop, powered by OpenClaw",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="dark">
          <Notifications position="top-right" zIndex={1000} />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
