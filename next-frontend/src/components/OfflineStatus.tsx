"use client";

import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, Database, AlertCircle } from "lucide-react";
import { offlineStorage } from "@/lib/offlineStorage";

interface OfflineStatusProps {
  className?: string;
  showDraftCount?: boolean;
}

export const OfflineStatus: React.FC<OfflineStatusProps> = ({
  className = "",
  showDraftCount = true,
}) => {
  const [isOnline, setIsOnline] = useState(true);
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const updateOnline = () => setIsOnline(true);
      const updateOffline = () => setIsOnline(false);

      window.addEventListener("online", updateOnline);
      window.addEventListener("offline", updateOffline);

      // Check draft count
      const drafts = offlineStorage.getAllDrafts();
      setDraftCount(drafts.length);

      return () => {
        window.removeEventListener("online", updateOnline);
        window.removeEventListener("offline", updateOffline);
      };
    }
  }, []);

  return (
    <div className={`inline-flex items-center gap-3 text-xs ${className}`}>
      {isOnline ? (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#16805B]/10 text-[#16805B] border border-[#16805B]/30 font-medium"
          title="Online - Real-time sync with Hospital Triage Server active"
        >
          <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Server Connected</span>
        </span>
      ) : (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#B7791F]/15 text-[#B7791F] border border-[#B7791F]/35 font-medium animate-pulse"
          title="Offline - Local draft storage enabled"
        >
          <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Offline Mode (Local Cache)</span>
        </span>
      )}

      {showDraftCount && draftCount > 0 && (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/30 font-medium"
          title={`${draftCount} local draft(s) stored in IndexedDB/localStorage`}
        >
          <Database className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{draftCount} Local Draft{draftCount > 1 ? "s" : ""}</span>
        </span>
      )}

      {!isOnline && (
        <div className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[#B7791F] font-medium">
          <AlertCircle className="w-3 h-3" />
          <span>Language service unavailable. Continue with manual entry or request staff assistance.</span>
        </div>
      )}
    </div>
  );
};
