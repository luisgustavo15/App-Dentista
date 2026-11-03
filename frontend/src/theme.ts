// Design tokens for Clínica Odontológica Dr. Jocélio. Light + dark themes.
import { useMemo, useSyncExternalStore } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

import { storage } from "@/src/utils/storage";

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces
  surface: "#FFFFFF",
  onSurface: "#111827",
  surfaceSecondary: "#F4F8FB",
  onSurfaceSecondary: "#374151",
  surfaceTertiary: "#E1EFFE",
  onSurfaceTertiary: "#1E40AF",
  surfaceInverse: "#111827",
  onSurfaceInverse: "#FFFFFF",
  muted: "#6B7280",

  // Brand - classic dental blue
  brand: "#1A73E8",
  onBrand: "#FFFFFF",
  brandPrimary: "#1A73E8",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E8F0FE",
  onBrandSecondary: "#1A73E8",
  brandTertiary: "#D2E3FC",
  onBrandTertiary: "#174EA6",

  // Status
  success: "#10B981",
  onSuccess: "#FFFFFF",
  warning: "#F59E0B",
  onWarning: "#FFFFFF",
  error: "#EF4444",
  onError: "#FFFFFF",
  info: "#3B82F6",
  onInfo: "#FFFFFF",

  // Lines
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  divider: "#F3F4F6",
};

export type ThemeColors = typeof light;

const dark: ThemeColors = {
  surface: "#0B1220",
  onSurface: "#F3F4F6",
  surfaceSecondary: "#151E2E",
  onSurfaceSecondary: "#CBD5E1",
  surfaceTertiary: "#1E2A40",
  onSurfaceTertiary: "#93C5FD",
  surfaceInverse: "#F3F4F6",
  onSurfaceInverse: "#111827",
  muted: "#94A3B8",

  brand: "#4C8DF6",
  onBrand: "#FFFFFF",
  brandPrimary: "#4C8DF6",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#1A2B4A",
  onBrandSecondary: "#93C5FD",
  brandTertiary: "#1E3A66",
  onBrandTertiary: "#BFDBFE",

  success: "#34D399",
  onSuccess: "#052E1C",
  warning: "#FBBF24",
  onWarning: "#3B2503",
  error: "#F87171",
  onError: "#3B0A0A",
  info: "#60A5FA",
  onInfo: "#0B1A33",

  border: "#243045",
  borderStrong: "#334155",
  divider: "#1A2233",
};

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

/** Static light palette — only for places outside React (prefer useTheme()). */
export const colors = light;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

// User preference: "light" | "dark" | null (follow system). Kept in a tiny store so web works too.
export type ThemePreference = ColorScheme | "system";
const THEME_PREF_KEY = "theme_preference";
let preference: ThemePreference = "system";
const listeners = new Set<() => void>();

export function setColorScheme(scheme: ColorScheme | null) {
  preference = scheme ?? "system";
  Appearance.setColorScheme?.(scheme ?? "unspecified");
  listeners.forEach((l) => l());
}

export async function setThemePreference(pref: ThemePreference) {
  setColorScheme(pref === "system" ? null : pref);
  await storage.setItem(THEME_PREF_KEY, pref);
}

export async function loadThemePreference() {
  const pref = await storage.getItem<ThemePreference>(THEME_PREF_KEY, "system");
  setColorScheme(pref === "system" ? null : (pref as ColorScheme));
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => preference,
    () => preference,
  );
}

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const pref = useThemePreference();
  const resolved = pref === "system" ? system : pref;
  const scheme: ColorScheme = resolved === "dark" && themes.dark ? "dark" : "light";
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
