"use client";

import React from "react";
import { ClinicalPriority } from "@/types/syna";
import {
  AlertOctagon,
  AlertTriangle,
  Clock,
  CheckCircle,
  FileQuestion,
  ShieldAlert,
  ArrowRightCircle,
  Flame,
} from "lucide-react";

interface StatusBadgeProps {
  type: "priority" | "status" | "missing" | "contradiction" | "warning";
  value: string;
  className?: string;
  size?: "sm" | "md";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type,
  value,
  className = "",
  size = "md",
}) => {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs";

  if (type === "priority") {
    const priority = value as ClinicalPriority;
    switch (priority) {
      case "critical":
        return (
          <span
            className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-full bg-[#C24141]/15 text-[#C24141] border border-[#C24141]/30 ${sizeClasses} ${className}`}
            role="status"
            aria-label="Provisional Priority: Critical"
          >
            <Flame className="w-3.5 h-3.5 text-[#C24141] animate-pulse" aria-hidden="true" />
            <span>Provisional: Critical</span>
          </span>
        );
      case "urgent":
        return (
          <span
            className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-full bg-[#B7791F]/15 text-[#B7791F] border border-[#B7791F]/30 ${sizeClasses} ${className}`}
            role="status"
            aria-label="Provisional Priority: Urgent"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-[#B7791F]" aria-hidden="true" />
            <span>Provisional: Urgent</span>
          </span>
        );
      case "concerning":
        return (
          <span
            className={`inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider rounded-full bg-[#2563EB]/15 text-[#2563EB] border border-[#2563EB]/30 ${sizeClasses} ${className}`}
            role="status"
            aria-label="Provisional Priority: Concerning"
          >
            <Clock className="w-3.5 h-3.5 text-[#2563EB]" aria-hidden="true" />
            <span>Provisional: Concerning</span>
          </span>
        );
      case "stable":
      default:
        return (
          <span
            className={`inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider rounded-full bg-[#16805B]/15 text-[#16805B] border border-[#16805B]/30 ${sizeClasses} ${className}`}
            role="status"
            aria-label="Provisional Priority: Stable"
          >
            <CheckCircle className="w-3.5 h-3.5 text-[#16805B]" aria-hidden="true" />
            <span>Provisional: Stable</span>
          </span>
        );
    }
  }

  if (type === "missing") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-[#8C9BAE]/20 text-[#5B6575] border border-[#8C9BAE]/30 ${sizeClasses} ${className}`}
        role="status"
      >
        <FileQuestion className="w-3.5 h-3.5 text-[#5B6575]" aria-hidden="true" />
        <span>Missing Info: {value}</span>
      </span>
    );
  }

  if (type === "contradiction") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-[#C24141]/15 text-[#C24141] border border-[#C24141]/30 ${sizeClasses} ${className}`}
        role="alert"
      >
        <AlertOctagon className="w-3.5 h-3.5 text-[#C24141]" aria-hidden="true" />
        <span>Contradictory Response</span>
      </span>
    );
  }

  if (type === "warning") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-[#B7791F]/15 text-[#B7791F] border border-[#B7791F]/30 ${sizeClasses} ${className}`}
        role="status"
      >
        <ShieldAlert className="w-3.5 h-3.5 text-[#B7791F]" aria-hidden="true" />
        <span>{value}</span>
      </span>
    );
  }

  // Review Status
  switch (value) {
    case "awaiting_review":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-[#B7791F]/15 text-[#B7791F] border border-[#B7791F]/30 ${sizeClasses} ${className}`}
          role="status"
        >
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Requires Nurse Review</span>
        </span>
      );
    case "verified":
    case "reviewed":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-[#16805B]/15 text-[#16805B] border border-[#16805B]/30 ${sizeClasses} ${className}`}
          role="status"
        >
          <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Nurse Confirmed</span>
        </span>
      );
    case "overridden":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-[#2563EB]/15 text-[#2563EB] border border-[#2563EB]/30 ${sizeClasses} ${className}`}
          role="status"
        >
          <ArrowRightCircle className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Nurse Overridden</span>
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-[#5B6575]/15 text-[#5B6575] border border-[#5B6575]/30 ${sizeClasses} ${className}`}
          role="status"
        >
          <span>{value}</span>
        </span>
      );
  }
};
