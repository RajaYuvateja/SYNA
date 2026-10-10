"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  Mic,
  Ambulance,
  LayoutDashboard,
  ShieldCheck,
  Globe,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { NeumorphicCard } from "@/components/NeumorphicCard";
import { NeumorphicButton } from "@/components/NeumorphicButton";
import { LanguageSelector } from "@/components/LanguageSelector";
import { SUPPORTED_LANGUAGES } from "@/lib/mockData";
import { RegionalLanguage } from "@/types/syna";

export default function HomePage() {
  const [selectedLang, setSelectedLang] = useState<RegionalLanguage>("te");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-6 pt-4">
        {/* Soft Neumorphic Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E8EDF2] shadow-neu-raised border border-white/80 text-xs font-bold text-[#2563EB]">
          <Activity className="w-4 h-4 text-[#2563EB] animate-pulse" />
          <span>Multilingual Clinical Voice Triage &amp; Nurse Handoff</span>
          <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-[#2563EB]/15 text-[#1E40AF]">
            Powered by Sarvam AI
          </span>
        </div>

        <div className="space-y-3 max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#172033]">
            SYNA
          </h1>
          <p className="text-xl sm:text-2xl font-semibold text-[#2563EB]">
            Every Voice, Understood in Time.
          </p>
          <p className="text-sm sm:text-base text-[#5B6575] leading-relaxed max-w-2xl mx-auto font-normal">
            A voice-first clinical intake and nurse handoff platform designed for Indian emergency and outpatient healthcare environments. Patients speak naturally in Telugu, Tamil, Hindi, Kannada, and other regional languages; nurses receive an evidence-linked, verified structured handoff in seconds.
          </p>
        </div>

        {/* Language selector in Hero */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <span className="text-xs font-bold text-[#5B6575] uppercase tracking-wider">
            Explore Preferred Language:
          </span>
          <LanguageSelector
            currentLanguage={selectedLang}
            onLanguageChange={(l) => setSelectedLang(l)}
          />
        </div>
      </section>

      {/* Primary Triage Route Action Launchers */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {/* 1. Patient Voice Intake */}
        <NeumorphicCard
          variant="raised"
          highlight="blue"
          className="p-6 flex flex-col justify-between hover:translate-y-[-2px] transition-all"
        >
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#E8EDF2] shadow-neu-raised flex items-center justify-center border border-white/80 text-[#2563EB]">
              <Mic className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
                Patient &amp; Caregiver
              </span>
              <h2 className="text-xl font-bold text-[#172033] mt-0.5">
                Voice Intake &amp; Clarification
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#5B6575] leading-relaxed">
              Express symptoms naturally using voice in your mother tongue. Instant audio waveform, guided short-sentence capture, adaptive clarification, and read-back confirmation.
            </p>
          </div>

          <div className="pt-6">
            <Link href="/patient" className="block w-full">
              <NeumorphicButton
                variant="primary"
                size="lg"
                className="w-full"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Start Voice Intake
              </NeumorphicButton>
            </Link>
          </div>
        </NeumorphicCard>

        {/* 2. Nurse Command Center */}
        <NeumorphicCard
          variant="raised"
          highlight="none"
          className="p-6 flex flex-col justify-between hover:translate-y-[-2px] transition-all"
        >
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#E8EDF2] shadow-neu-raised flex items-center justify-center border border-white/80 text-[#16805B]">
              <LayoutDashboard className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#16805B]">
                Clinical Staff
              </span>
              <h2 className="text-xl font-bold text-[#172033] mt-0.5">
                Nurse Command Center
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#5B6575] leading-relaxed">
              Prioritized case queue, rule-based safety flags, missing field indicators, contradiction highlights, original speech playback, and full clinician verification controls.
            </p>
          </div>

          <div className="pt-6">
            <Link href="/nurse" className="block w-full">
              <NeumorphicButton
                variant="default"
                size="lg"
                className="w-full text-[#16805B] font-bold"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Open Nurse Dashboard
              </NeumorphicButton>
            </Link>
          </div>
        </NeumorphicCard>

        {/* 3. Paramedic Pre-Arrival Telemetry */}
        <NeumorphicCard
          variant="raised"
          highlight="danger"
          className="p-6 flex flex-col justify-between hover:translate-y-[-2px] transition-all"
        >
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#E8EDF2] shadow-neu-raised flex items-center justify-center border border-white/80 text-[#C24141]">
              <Ambulance className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#C24141]">
                Ambulance &amp; EMS
              </span>
              <h2 className="text-xl font-bold text-[#172033] mt-0.5">
                Paramedic Fast Intake
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#5B6575] leading-relaxed">
              Rapid in-transit telemetry submission: live vitals, ETA countdown, Fast-Code priority (Code Red/Yellow), voice dictation notes, and immediate ED alert.
            </p>
          </div>

          <div className="pt-6">
            <Link href="/paramedic" className="block w-full">
              <NeumorphicButton
                variant="default"
                size="lg"
                className="w-full text-[#C24141] font-bold"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Launch EMS Telemetry
              </NeumorphicButton>
            </Link>
          </div>
        </NeumorphicCard>
      </section>

      {/* Multilingual Support Badges */}
      <section className="p-6 rounded-3xl bg-[#DEE5EC]/70 shadow-neu-pressed border border-white/50 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#2563EB]" />
            <h3 className="text-sm font-bold text-[#172033]">
              Sarvam AI Multilingual Indic Speech Coverage
            </h3>
          </div>
          <span className="text-xs text-[#5B6575]">
            ASR (Saaras:v1) • Translation (Mayura:v1) • TTS (Bulbul:v1)
          </span>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <div
              key={lang.code}
              className="px-3 py-1.5 rounded-xl bg-[#E8EDF2] shadow-neu-raised border border-white/70 text-xs font-semibold text-[#172033] flex items-center gap-2"
            >
              <span aria-hidden="true">{lang.flag}</span>
              <span>{lang.nativeLabel}</span>
              <span className="text-[10px] text-[#5B6575]">({lang.label})</span>
            </div>
          ))}
        </div>
      </section>

      {/* Safety & Clinical Governance Statement */}
      <section className="p-6 rounded-3xl bg-[#E8EDF2] shadow-neu-raised border-2 border-white/80 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-[#C24141]/10 text-[#C24141] border border-[#C24141]/30 flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#172033]">
              Mandatory Clinical Safety Notice &amp; Operational Boundaries
            </h3>
            <p className="text-xs sm:text-sm text-[#5B6575] leading-relaxed">
              SYNA is an assistive intake and structured handoff support tool. It is <strong className="text-[#172033]">NOT an autonomous diagnostic system</strong>. SYNA does not diagnose medical diseases, prescribe medications, recommend treatments, or finalize triage determinations.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 space-y-1">
            <div className="font-bold text-[#172033] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16805B]" />
              <span>Human Clinician In The Loop</span>
            </div>
            <p className="text-[#5B6575]">
              Every extracted field must be reviewed, verified, accepted, or overridden by a qualified nurse before handoff.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 space-y-1">
            <div className="font-bold text-[#172033] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-[#B7791F]" />
              <span>Transparent Confidence Labels</span>
            </div>
            <p className="text-[#5B6575]">
              Speech recognition and entity extractions explicitly display confidence metrics and source attribution.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 space-y-1">
            <div className="font-bold text-[#172033] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Immutable Audit Trail</span>
            </div>
            <p className="text-[#5B6575]">
              Full chronological logging distinguishes AI draft predictions from patient confirmations and nurse overrides.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-[#5B6575] space-y-2 border-t border-black/5">
        <p className="font-semibold text-[#172033]">
          SYNA — End-to-End Multilingual Clinical Voice Triage &amp; Nurse Handoff Platform
        </p>
        <p>
          Synthetic demonstration data — not real patient data. Designed for Indian Healthcare Environments.
        </p>
      </footer>
    </div>
  );
}
