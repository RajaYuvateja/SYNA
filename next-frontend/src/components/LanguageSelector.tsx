"use client";

import React, { useState, useRef, useEffect } from "react";
import { RegionalLanguage, LanguageOption } from "@/types/syna";
import { SUPPORTED_LANGUAGES } from "@/lib/mockData";
import { Globe, ChevronDown, Check } from "lucide-react";

interface LanguageSelectorProps {
  currentLanguage: RegionalLanguage;
  onLanguageChange: (lang: RegionalLanguage) => void;
  variant?: "compact" | "full";
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  onLanguageChange,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeOption =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select language. Current language is ${activeOption.label} (${activeOption.nativeLabel})`}
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#E8EDF2] shadow-neu-raised hover:bg-[#EEF2F6] active:shadow-neu-pressed border border-white/60 text-[#172033] font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50"
      >
        <Globe className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
        <span className="font-semibold">{activeOption.nativeLabel}</span>
        <span className="text-xs text-[#5B6575]">({activeOption.label})</span>
        <ChevronDown
          className={`w-4 h-4 text-[#5B6575] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          aria-label="Available languages"
          className="absolute right-0 mt-2.5 w-64 rounded-2xl bg-[#E8EDF2] shadow-neu-raised border border-white/70 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 max-h-80 overflow-y-auto"
        >
          <div className="px-3 py-1.5 text-xs font-bold text-[#5B6575] uppercase tracking-wider border-b border-black/5">
            Select Preferred Language
          </div>
          <div className="mt-1 space-y-1">
            {SUPPORTED_LANGUAGES.map((lang: LanguageOption) => {
              const isSelected = lang.code === currentLanguage;
              return (
                <button
                  key={lang.code}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onLanguageChange(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm text-left transition-all ${
                    isSelected
                      ? "bg-[#DEE5EC] shadow-neu-pressed text-[#2563EB] font-bold"
                      : "hover:bg-[#EEF2F6] text-[#172033]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base" aria-hidden="true">{lang.flag}</span>
                    <div>
                      <div className="font-semibold leading-tight">{lang.nativeLabel}</div>
                      <div className="text-xs text-[#5B6575]">{lang.label}</div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
