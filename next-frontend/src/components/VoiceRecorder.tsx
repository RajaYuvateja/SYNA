"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, RotateCcw, AlertCircle, Volume2, Type } from "lucide-react";
import { NeumorphicButton } from "./NeumorphicButton";
import { AudioWaveform } from "./AudioWaveform";

export interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, durationSeconds: number) => void;
  onManualTextSubmit?: (text: string) => void;
  isProcessing?: boolean;
  disabled?: boolean;
  promptGuidance?: string;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onManualTextSubmit,
  isProcessing = false,
  disabled = false,
  promptGuidance = "Speak clearly in short sentences. Mention your main pain, when it began, and any known conditions.",
}) => {
  const [recorderState, setRecorderState] = useState<"idle" | "recording" | "paused" | "recorded">("idle");
  const [duration, setDuration] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualText, setManualText] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    setPermissionError(null);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone API not supported on this browser or context.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        recordedBlobRef.current = audioBlob;
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      mediaRecorder.start(250);
      setRecorderState("recording");
      setDuration(0);

      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn("Microphone access error:", err);
      setPermissionError("Microphone access is unavailable or was denied. You can type your response below.");
      setShowManualInput(true);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recorderState === "recording") {
      mediaRecorderRef.current.pause();
      setRecorderState("paused");
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && recorderState === "paused") {
      mediaRecorderRef.current.resume();
      setRecorderState("recording");
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (recorderState === "recording" || recorderState === "paused")) {
      mediaRecorderRef.current.stop();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setRecorderState("recorded");
    }
  };

  const handleReset = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    recordedBlobRef.current = null;
    setDuration(0);
    setRecorderState("idle");
    setIsPlayingAudio(false);
  };

  const handleSubmitRecording = () => {
    if (recordedBlobRef.current) {
      onRecordingComplete(recordedBlobRef.current, duration);
    }
  };

  const handleTogglePlayback = () => {
    if (!audioPlayerRef.current && audioUrl) {
      audioPlayerRef.current = new Audio(audioUrl);
      audioPlayerRef.current.onended = () => setIsPlayingAudio(false);
    }

    if (audioPlayerRef.current) {
      if (isPlayingAudio) {
        audioPlayerRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioPlayerRef.current.play();
        setIsPlayingAudio(true);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualText.trim() && onManualTextSubmit) {
      onManualTextSubmit(manualText.trim());
      setManualText("");
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full space-y-4">
      {/* Guidance box */}
      <div className="p-3.5 rounded-2xl bg-[#DEE5EC]/70 shadow-neu-pressed border border-white/40 flex items-start gap-3">
        <Volume2 className="w-5 h-5 text-[#2563EB] flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-xs sm:text-sm text-[#172033] leading-relaxed">
          <span className="font-semibold text-[#1E40AF]">Voice Guidance: </span>
          {promptGuidance}
        </div>
      </div>

      {/* Permission alert if denied */}
      {permissionError && (
        <div className="p-3.5 rounded-2xl bg-[#C24141]/10 border border-[#C24141]/30 flex items-start gap-3 text-xs sm:text-sm text-[#C24141]">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">{permissionError}</div>
        </div>
      )}

      {/* Live Waveform visualizer */}
      <AudioWaveform
        isRecording={recorderState === "recording"}
        isPlaying={isPlayingAudio}
        stream={mediaStreamRef.current}
      />

      {/* Main Recording Center & Controls */}
      <div className="flex flex-col items-center justify-center pt-2 pb-1">
        {/* Timer display */}
        <div className="text-2xl sm:text-3xl font-mono font-bold tracking-wider text-[#172033] mb-3">
          {formatTime(duration)}
        </div>

        {/* Big Central Record Button */}
        {recorderState === "idle" && (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              disabled={disabled || isProcessing}
              onClick={startRecording}
              aria-label="Start voice recording"
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-[#2563EB] to-[#3B82F6] text-white flex items-center justify-center shadow-neu-blue hover:brightness-110 active:scale-95 transition-all duration-200 border-4 border-white/40 focus:outline-none focus:ring-4 focus:ring-[#2563EB]/40 cursor-pointer"
            >
              <Mic className="w-10 h-10 sm:w-12 sm:h-12" aria-hidden="true" />
            </button>
            <span className="text-sm font-semibold text-[#172033]">Tap to Speak</span>
          </div>
        )}

        {/* Controls while recording / paused */}
        {(recorderState === "recording" || recorderState === "paused") && (
          <div className="flex items-center gap-4">
            {recorderState === "recording" ? (
              <NeumorphicButton
                variant="default"
                size="lg"
                onClick={pauseRecording}
                ariaLabel="Pause recording"
                leftIcon={<Pause className="w-5 h-5 text-[#B7791F]" />}
              >
                Pause
              </NeumorphicButton>
            ) : (
              <NeumorphicButton
                variant="default"
                size="lg"
                onClick={resumeRecording}
                ariaLabel="Resume recording"
                leftIcon={<Play className="w-5 h-5 text-[#2563EB]" />}
              >
                Resume
              </NeumorphicButton>
            )}

            <button
              type="button"
              onClick={stopRecording}
              aria-label="Stop recording"
              className="w-16 h-16 rounded-full bg-[#C24141] text-white flex items-center justify-center shadow-[6px_6px_14px_rgba(194,65,65,0.35),-6px_-6px_14px_rgba(255,255,255,0.8)] hover:bg-[#B33434] active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-[#C24141]/40"
            >
              <Square className="w-6 h-6 fill-current" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Controls after recorded */}
        {recorderState === "recorded" && (
          <div className="w-full flex flex-wrap items-center justify-center gap-3">
            <NeumorphicButton
              variant="default"
              size="md"
              onClick={handleTogglePlayback}
              ariaLabel={isPlayingAudio ? "Pause preview" : "Replay recorded voice"}
              leftIcon={
                isPlayingAudio ? (
                  <Pause className="w-4 h-4 text-[#2563EB]" />
                ) : (
                  <Play className="w-4 h-4 text-[#16805B]" />
                )
              }
            >
              {isPlayingAudio ? "Pause Replay" : "Listen Back"}
            </NeumorphicButton>

            <NeumorphicButton
              variant="default"
              size="md"
              onClick={handleReset}
              ariaLabel="Re-record audio"
              leftIcon={<RotateCcw className="w-4 h-4 text-[#5B6575]" />}
            >
              Record Again
            </NeumorphicButton>

            <NeumorphicButton
              variant="primary"
              size="lg"
              disabled={isProcessing}
              onClick={handleSubmitRecording}
              ariaLabel="Process voice with Sarvam AI"
            >
              {isProcessing ? "Processing Speech..." : "Analyze Symptoms"}
            </NeumorphicButton>
          </div>
        )}
      </div>

      {/* Manual text alternative toggle */}
      <div className="pt-2 flex flex-col items-center">
        <button
          type="button"
          onClick={() => setShowManualInput(!showManualInput)}
          className="text-xs font-semibold text-[#2563EB] hover:text-[#1E40AF] underline focus:outline-none cursor-pointer flex items-center gap-1.5"
        >
          <Type className="w-3.5 h-3.5" aria-hidden="true" />
          {showManualInput ? "Hide typed input fallback" : "Prefer typing or microphone not working?"}
        </button>

        {showManualInput && (
          <form onSubmit={handleManualSubmit} className="w-full mt-3 space-y-2 animate-in fade-in duration-200">
            <label htmlFor="manual-symptom-text" className="block text-xs font-semibold text-[#5B6575]">
              Type your symptoms directly (Telugu, Tamil, Hindi, Kannada, English, etc.):
            </label>
            <div className="flex gap-2">
              <input
                id="manual-symptom-text"
                type="text"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="E.g., ఛాతీలో తీవ్రమైన నొప్పి ఉంది / chest pain radiating to arm..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-[#172033] placeholder-[#8C9BAE] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
              <NeumorphicButton
                variant="primary"
                size="md"
                type="submit"
                disabled={!manualText.trim()}
              >
                Submit
              </NeumorphicButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
