import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../components/theme-provider";
import { ThemeSwitch } from "../components/theme-switch";
import { supabase } from "@/lib/supabase";
import { Sparkles, Plus, Library, User, LogOut, ChefHat } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Recipe Manager",
  description: "Extract and manage recipes from YouTube and websites",
};

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-primary font-sans antialiased transition-colors">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          themes={['light', 'dark', 'instagram', 'twilight', 'sunset']}
        >
          <nav className="sticky top-0 z-50 w-full bg-background-secondary border-b border-primary/10 shadow-sm backdrop-blur-md">
            <div className="max-w-5xl mx-auto flex justify-between items-center px-6 py-3">
              <a href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-primary hover:opacity-80 transition-opacity">
                <ChefHat className="text-primary w-6 h-6" />
                <span className="bg-span-bg bg-clip-text text-transparent hidden sm:block">Recipe Manager</span>
              </a>
              
              <div className="flex gap-2 sm:gap-4 items-center">
                <div className="flex items-center gap-1 sm:gap-2 mr-2">
                  <a href="/extract" title="Extract Recipe" className="p-2.5 text-text-secondary hover:text-primary hover:bg-primary/5 rounded-xl transition-all group relative">
                    <Sparkles size={22} />
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">Extract Recipe</span>
                  </a>
                  <a href="/add" title="Add Your Own Recipe" className="p-2.5 text-text-secondary hover:text-primary hover:bg-primary/5 rounded-xl transition-all group relative">
                    <Plus size={24} />
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">Add Your Own Recipe</span>
                  </a>
                  <a href="/library" title="Library" className="p-2.5 text-text-secondary hover:text-primary hover:bg-primary/5 rounded-xl transition-all group relative">
                    <Library size={22} />
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">Library</span>
                  </a>
                </div>

                <div className="h-6 w-px bg-primary/10 mx-1 sm:mx-2 hidden xs:block" />

                <div className="flex items-center gap-3">
                  <ThemeSwitch />
                  
                  <a href="/login" title="Account" className="w-10 h-10 bg-primary text-background rounded-xl flex items-center justify-center hover:opacity-90 transition-all shadow-sm group relative">
                    <User size={20} />
                    <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">Account</span>
                  </a>
                </div>
              </div>
            </div>
          </nav>
          <main className="max-w-4xl mx-auto px-6 sm:px-10 lg:px-12 py-12 md:py-16">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
