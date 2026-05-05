export type SupportedLanguage = "uz" | "ru" | "en";

export type LocalizedText = {
  uz: string;
  ru: string;
  en: string;
};

export function buildLocalizedText(
  uz: string,
  ru?: string | null,
  en?: string | null
): LocalizedText {
  return {
    uz,
    ru: ru?.trim() || uz,
    en: en?.trim() || uz
  };
}

export function isLocalizedText(value: unknown): value is LocalizedText {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.uz === "string" &&
    typeof candidate.ru === "string" &&
    typeof candidate.en === "string"
  );
}
