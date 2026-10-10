"use client";

import React, { useEffect, useState } from "react";

interface AudioWaveformProps {
  isRecording?: boolean;
  isPlaying?: boolean;
  barCount?: number;
  className?: string;
  stream?: MediaStream | null;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isRecording = false,
  isPlaying = false,
  barCount = 28,
  className = "",
  stream = null,
}) => {
  const [amplitudes, setAmplitudes] = useState<number[]>(() =>
    Array.from({ length: barCount }, () => 0.15)
  );

  useEffect(() => {
    let animationFrameId: number;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    if (isRecording && stream) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContext = new AudioCtx();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateLive = () => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);

          const step = Math.max(1, Math.floor(dataArray.length / barCount));
          const newAmps = Array.from({ length: barCount }, (_, i) => {
            const val = dataArray[i * step] || 10;
            return Math.max(0.12, Math.min(1.0, val / 255));
          });
          setAmplitudes(newAmps);
          animationFrameId = requestAnimationFrame(updateLive);
        };

        updateLive();
      } catch {
        // Fallback to simulated gentle pulse below
      }
    } else if (isRecording || isPlaying) {
      // Gentle animated pulse simulating voice activity
      let t = 0;
      const interval = setInterval(() => {
        t += 0.2;
        setAmplitudes(
          Array.from({ length: barCount }, (_, i) => {
            const wave = Math.sin(t + i * 0.35) * 0.35 + 0.45;
            const noise = (Math.random() - 0.5) * 0.2;
            return Math.max(0.12, Math.min(0.95, wave + noise));
          })
        );
      }, 70);

      return () => clearInterval(interval);
    } else {
      setAmplitudes(Array.from({ length: barCount }, () => 0.12));
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (source) source.disconnect();
      if (audioContext && audioContext.state !== "closed") audioContext.close();
    };
  }, [isRecording, isPlaying, stream, barCount]);

  return (
    <div
      className={`flex items-center justify-center gap-1 sm:gap-1.5 h-16 px-4 py-2 rounded-2xl bg-[#DEE5EC] shadow-neu-pressed border border-white/40 ${className}`}
      role="img"
      aria-label={isRecording ? "Live audio recording waveform" : "Audio waveform visualizer"}
    >
      {amplitudes.map((amp, index) => {
        const heightPx = Math.max(6, Math.round(amp * 48));
        const isHighlight = isRecording || isPlaying;

        return (
          <div
            key={index}
            className={`w-1 sm:w-1.5 rounded-full transition-all duration-75 ${
              isHighlight
                ? isRecording
                  ? "bg-gradient-to-t from-[#2563EB] to-[#60A5FA]"
                  : "bg-gradient-to-t from-[#16805B] to-[#34D399]"
                : "bg-[#8C9BAE]/40"
            }`}
            style={{
              height: `${heightPx}px`,
              opacity: isHighlight ? 0.9 : 0.4,
            }}
          />
        );
      })}
    </div>
  );
};
