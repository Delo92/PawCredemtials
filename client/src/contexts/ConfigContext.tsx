import { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { defaultConfig, type WhiteLabelConfig } from "@shared/config";

interface ConfigContextType {
  config: WhiteLabelConfig;
  isLoading: boolean;
  getLevelName: (level: number) => string;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const { data: serverConfig, isLoading } = useQuery<WhiteLabelConfig>({
    queryKey: ["/api/config"],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const config = serverConfig || defaultConfig;

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
