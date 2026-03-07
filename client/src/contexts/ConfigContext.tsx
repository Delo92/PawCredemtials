import { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { defaultConfig, type WhiteLabelConfig } from "@shared/config";

function hexToHsl(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

interface ConfigContextType {
  config: WhiteLabelConfig;
  isLoading: boolean;
  getLevelName: (level: number) => string;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const { data: serverConfig, isLoading } = useQuery<WhiteLabelConfig>({
    queryKey: ["/api/config"],
    staleTime: 1000 * 60 * 5,
  });

  const config = serverConfig || defaultConfig;

  useEffect(() => {
    const root = document.documentElement;
    if (config.primaryColor) {
      const hsl = hexToHsl(config.primaryColor);
      if (hsl) root.style.setProperty("--primary", hsl);
    }
    if (config.secondaryColor) {
      const hsl = hexToHsl(config.secondaryColor);
      if (hsl) root.style.setProperty("--secondary", hsl);
    }
    if (config.accentColor) {
      const hsl = hexToHsl(config.accentColor);
      if (hsl) root.style.setProperty("--accent", hsl);
    }
  }, [config.primaryColor, config.secondaryColor, config.accentColor]);

  const getLevelName = (level: number): string => {
    switch (level) {
      case 1:
        return config.levelNames.level1;
      case 2:
        return config.levelNames.level2;
      case 3:
        return config.levelNames.level3;
      case 4:
        return config.levelNames.level4;
      default:
        return "Unknown";
    }
  };

  return (
    <ConfigContext.Provider value={{ config, isLoading, getLevelName }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
}
