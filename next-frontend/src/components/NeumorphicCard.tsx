"use client";

import React from "react";

export interface NeumorphicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "raised" | "raised-sm" | "pressed" | "flat";
  highlight?: "none" | "blue" | "danger" | "warning" | "success";
  className?: string;
  children: React.ReactNode;
}

export const NeumorphicCard: React.FC<NeumorphicCardProps> = ({
  variant = "raised",
  highlight = "none",
  className = "",
  children,
  ...props
}) => {
  const getShadowClass = () => {
    switch (variant) {
      case "pressed":
        return "shadow-neu-pressed bg-[#E2E8EE]";
      case "raised-sm":
        return "shadow-neu-raised-sm bg-[#E8EDF2]";
      case "flat":
        return "bg-[#E8EDF2] border border-white/60";
      case "raised":
      default:
        return "shadow-neu-raised bg-[#E8EDF2]";
    }
  };

  const getHighlightClass = () => {
    switch (highlight) {
      case "blue":
        return "border-l-4 border-l-[#2563EB]";
      case "danger":
        return "border-l-4 border-l-[#C24141]";
      case "warning":
        return "border-l-4 border-l-[#B7791F]";
      case "success":
        return "border-l-4 border-l-[#16805B]";
      default:
        return "border border-white/60";
    }
  };

  return (
    <div
      className={`rounded-2xl transition-all duration-200 ${getShadowClass()} ${getHighlightClass()} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
