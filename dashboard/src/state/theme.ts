export type ColorTheme = "light" | "dark";
export type ThemePreference = "system" | ColorTheme;

export function resolveThemePreference(savedTheme: string | null): ThemePreference {
  if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") return savedTheme;
  return "system";
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ColorTheme {
  if (preference === "light" || preference === "dark") return preference;
  return prefersDark ? "dark" : "light";
}
