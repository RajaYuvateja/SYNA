"use client";

import React, { useState } from "react";
import { AudioEvidenceSnippet } from "@/types/syna";
import { Play, Pause, Mic } from "lucide-react";
import { NeumorphicButton } from "./NeumorphicButton";

interface EvidencePanelProps {
  snippets: AudioEvidenceSnippet[];
  className?: string;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  snippets,
  className = "",
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);

  const togglePlay = (id: string) => {
    if (playingId === id) {
      setPlayingId(null);
    } else {
      setPlayingId(id);
      // Simulate playback duration
      setTimeout(() => {
        setPlayingId(null);
      }, 4500);
    }
  };

  if (!snippets || snippets.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-[#5B6575] bg-[#DEE5EC]/50 rounded-xl">
        No recorded speech evidence attached to this case.
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {snippets.map((snip, index) => {
        const isPlaying = playingId === snip.id;

        return (
          <div
            key={snip.id || index}
            className="p-3.5 rounded-2xl bg-[#DEE5EC]/80 shadow-neu-pressed border border-white/50 space-y-2.5 transition-all"
          >
            {/* Header: Turn index, duration, ASR confidence */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#172033]">
                <Mic className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Speech Segment #{snip.turnIndex || index + 1}</span>
                <span className="text-[11px] text-[#5B6575] font-normal">
                  ({snip.durationSeconds}s)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20">
                  Sarvam STT: {Math.round(snip.asrConfidence * 100)}%
                </span>
                <span className="text-[10px] font-mono text-[#5B6575]">
                  {snip.timestamp}
                </span>
              </div>
            </div>

            {/* Native language audio transcript */}
            <div className="p-2.5 rounded-xl bg-[#E8EDF2] border border-white/60">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#5B6575] mb-1">
                Original Spoken Speech ({snip.language.toUpperCase()})
              </div>
              <p className="text-xs sm:text-sm font-medium text-[#172033] leading-relaxed">
                &ldquo;{snip.nativeText}&rdquo;
              </p>
            </div>

            {/* Translated English clinical text */}
            <div className="p-2.5 rounded-xl bg-[#E8EDF2] border border-white/60">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] mb-1">
                Sarvam Mayura Translation (EN)
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#172033] leading-relaxed">
                {snip.englishText}
              </p>
            </div>

            {/* Audio Replay Button */}
            <div className="flex items-center justify-between pt-1">
              <NeumorphicButton
                variant={isPlaying ? "primary" : "default"}
                size="sm"
                onClick={() => togglePlay(snip.id)}
                ariaLabel={isPlaying ? "Pause snippet audio" : "Play original spoken audio snippet"}
                leftIcon={
                  isPlaying ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-[#16805B]" />
                  )
                }
              >
                {isPlaying ? "Playing Speech..." : "Listen to Patient Audio"}
              </NeumorphicButton>

              {isPlaying && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-4 bg-[#2563EB] rounded-full animate-bounce" />
                  <div className="w-1.5 h-6 bg-[#2563EB] rounded-full animate-bounce delay-100" />
                  <div className="w-1.5 h-3 bg-[#2563EB] rounded-full animate-bounce delay-200" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
