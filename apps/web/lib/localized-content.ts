export type SupportedLanguage = "uz" | "ru" | "en";

export type LocalizedText = {
  uz: string;
  ru: string;
  en: string;
};

export function getLocalizedText(
  value: LocalizedText | string | null | undefined,
  language: SupportedLanguage
): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return value[language] || value.uz || value.ru || value.en;
}
