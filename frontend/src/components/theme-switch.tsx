"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Palette } from "lucide-react";

export function ThemeSwitch() {
  const [mounted, setMounted] = React.useState(false);
  const { theme, setTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
    
    // Close dropdown on outside click
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-primary transition-colors bg-button-secondary rounded-md"
      >
        <Palette className="w-4 h-4" />
        <span className="capitalize">{theme}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 origin-top-right rounded-md bg-dropdown shadow-lg z-50 overflow-hidden border border-background-secondary">
          <div className="py-1">
            {themes.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTheme(t);
                  setIsOpen(false);
                }}
                className={`block w-full px-4 py-2 text-left text-sm hover:bg-dropdownHover ${
                  theme === t ? "bg-selected text-primary font-medium" : "text-text-secondary"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
