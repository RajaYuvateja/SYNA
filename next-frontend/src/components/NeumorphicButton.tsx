"use client";

import React from "react";

export interface NeumorphicButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "danger" | "success" | "ghost" | "inset";
  size?: "sm" | "md" | "lg" | "xl";
  isActive?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  children?: React.ReactNode;
}

export const NeumorphicButton: React.FC<NeumorphicButtonProps> = ({
  variant = "default",
  size = "md",
  isActive = false,
  leftIcon,
  rightIcon,
  className = "",
  ariaLabel,
  disabled = false,
  children,
  ...props
}) => {
  const getSizeClass = () => {
    switch (size) {
      case "sm":
        return "px-3.5 py-1.5 text-xs font-medium gap-1.5 rounded-xl min-h-[36px]";
      case "lg":
        return "px-6 py-3.5 text-base font-semibold gap-2.5 rounded-2xl min-h-[52px]";
      case "xl":
        return "px-8 py-4.5 text-lg font-bold gap-3 rounded-2xl min-h-[64px]";
      case "md":
      default:
        return "px-4.5 py-2.5 text-sm font-semibold gap-2 rounded-xl min-h-[44px]";
    }
  };

  const getVariantClass = () => {
    if (disabled) {
      return "opacity-50 cursor-not-allowed bg-[#E8EDF2] text-[#8C9BAE] border border-transparent shadow-none";
    }

    if (isActive) {
      return "shadow-neu-pressed bg-[#DEE5EC] text-[#2563EB] border border-white/40";
    }

    switch (variant) {
      case "primary":
        return "bg-gradient-to-br from-[#2563EB] to-[#1E40AF] text-white shadow-neu-blue hover:brightness-105 active:scale-[0.98] border border-blue-400/30";
      case "danger":
        return "bg-[#C24141] text-white shadow-[6px_6px_14px_rgba(194,65,65,0.35),-6px_-6px_14px_rgba(255,255,255,0.8)] hover:bg-[#B33434] active:scale-[0.98]";
      case "success":
        return "bg-[#16805B] text-white shadow-[6px_6px_14px_rgba(22,128,91,0.35),-6px_-6px_14px_rgba(255,255,255,0.8)] hover:bg-[#136F4F] active:scale-[0.98]";
      case "ghost":
        return "bg-transparent hover:bg-[#DCE3EB]/60 text-[#172033] border border-transparent";
      case "inset":
        return "bg-[#DEE5EC] shadow-neu-pressed text-[#172033] border border-white/40";
      case "default":
      default:
        return "bg-[#E8EDF2] text-[#172033] shadow-neu-raised hover:bg-[#EEF2F6] active:shadow-neu-pressed active:scale-[0.98] border border-white/60";
    }
  };

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 focus:ring-offset-2 focus:ring-offset-[#E8EDF2] ${getSizeClass()} ${getVariantClass()} ${className}`}
      {...props}
    >
      {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  );
};
