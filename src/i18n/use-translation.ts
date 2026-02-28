"use client";

import { useContext } from "react";
import { I18nContext, type I18nContextType } from "./provider";

export function useTranslation(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within I18nProvider");
  }
  return context;
}
