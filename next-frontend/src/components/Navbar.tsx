"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Mic,
  Ambulance,
  LayoutDashboard,
  FileText,
  Shield,
  Menu,
  X,
} from "lucide-react";
import { LanguageSelector } from "./LanguageSelector";
import { OfflineStatus } from "./OfflineStatus";
import { RegionalLanguage } from "@/types/syna";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const [selectedLang, setSelectedLang] = useState<RegionalLanguage>("te");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("syna_selected_language") as RegionalLanguage | null;
      if (saved) setSelectedLang(saved);

      const onLang = (e: any) => {
        if (e.detail) setSelectedLang(e.detail);
      };
      window.addEventListener("syna_language_changed", onLang);
      return () => window.removeEventListener("syna_language_changed", onLang);
    }
  }, []);

  const handleLanguageChange = (lang: RegionalLanguage) => {
    setSelectedLang(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("syna_selected_language", lang);
      window.dispatchEvent(new CustomEvent("syna_language_changed", { detail: lang }));
    }
  };

  const navLinks = [
    { href: "/", label: "Home", icon: <Activity className="w-4 h-4" /> },
    { href: "/patient", label: "Patient Voice", icon: <Mic className="w-4 h-4" /> },
    { href: "/paramedic", label: "Paramedic Fast", icon: <Ambulance className="w-4 h-4" /> },
    { href: "/nurse", label: "Nurse Command", icon: <LayoutDashboard className="w-4 h-4" /> },
    { href: "/audit", label: "Clinical Audit", icon: <FileText className="w-4 h-4" /> },
  ];

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#E8EDF2]/95 backdrop-blur-md border-b border-white/60 shadow-sm">
      {/* Top Clinical Safety Bar */}
      <div className="bg-[#DEE5EC] px-4 py-1 border-b border-white/40 text-[11px] text-[#5B6575] flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-medium">
          <Shield className="w-3.5 h-3.5 text-[#2563EB]" aria-hidden="true" />
          <span>
            SYNA Assistive Triage Aid — All information requires qualified clinician review. Not for autonomous diagnosis.
          </span>
        </div>
        <OfflineStatus showDraftCount={false} className="hidden md:inline-flex" />
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 rounded-xl p-1">
          <div className="w-10 h-10 rounded-2xl bg-[#E8EDF2] shadow-neu-raised flex items-center justify-center border border-white/80 group-hover:shadow-neu-pressed transition-all">
            <Activity className="w-5 h-5 text-[#2563EB]" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight text-[#172033]">SYNA</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-[#2563EB]/15 text-[#2563EB] border border-[#2563EB]/30">
                Sarvam AI
              </span>
            </div>
            <p className="text-[11px] font-medium text-[#5B6575] leading-none">
              Every Voice, Understood in Time.
            </p>
          </div>
        </Link>

        {/* Desktop Links */}
        <nav className="hidden lg:flex items-center gap-1.5 bg-[#DEE5EC] p-1.5 rounded-2xl shadow-neu-pressed border border-white/50" aria-label="Main Navigation">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all select-none ${
                  active
                    ? "bg-[#E8EDF2] shadow-neu-raised text-[#2563EB] border border-white/80"
                    : "text-[#5B6575] hover:text-[#172033] hover:bg-[#E8EDF2]/50"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Action Tools */}
        <div className="flex items-center gap-2.5">
          <LanguageSelector
            currentLanguage={selectedLang}
            onLanguageChange={handleLanguageChange}
          />

          <Link
            href="/patient"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1E40AF] text-white text-xs font-semibold shadow-neu-blue hover:brightness-105 active:scale-95 transition-all border border-blue-400/30"
          >
            <Mic className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Voice Intake</span>
          </Link>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            className="lg:hidden p-2.5 rounded-xl bg-[#E8EDF2] shadow-neu-raised text-[#172033] hover:bg-[#EEF2F6] active:shadow-neu-pressed border border-white/60 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden px-4 pt-2 pb-4 bg-[#E8EDF2] border-b border-white/70 space-y-2 animate-in slide-in-from-top duration-200">
          <div className="space-y-1">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    active
                      ? "bg-[#DEE5EC] shadow-neu-pressed text-[#2563EB] border border-white/50"
                      : "text-[#172033] hover:bg-[#DEE5EC]/60"
                  }`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="pt-2 border-t border-black/5 flex items-center justify-between">
            <OfflineStatus />
          </div>
        </div>
      )}
    </header>
  );
};
