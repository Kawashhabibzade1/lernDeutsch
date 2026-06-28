export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English",    nativeName: "English",     rtl: false },
  { code: "fa", name: "Persian",    nativeName: "فارسی",       rtl: true  },
  { code: "ru", name: "Russian",    nativeName: "Русский",     rtl: false },
  { code: "ar", name: "Arabic",     nativeName: "العربية",     rtl: true  },
  { code: "fr", name: "French",     nativeName: "Français",    rtl: false },
  { code: "es", name: "Spanish",    nativeName: "Español",     rtl: false },
  { code: "tr", name: "Turkish",    nativeName: "Türkçe",      rtl: false },
  { code: "zh", name: "Chinese",    nativeName: "中文",         rtl: false },
  { code: "it", name: "Italian",    nativeName: "Italiano",    rtl: false },
  { code: "pl", name: "Polish",     nativeName: "Polski",      rtl: false },
  { code: "uk", name: "Ukrainian",  nativeName: "Українська",  rtl: false },
  { code: "ja", name: "Japanese",   nativeName: "日本語",       rtl: false },
  { code: "ko", name: "Korean",     nativeName: "한국어",       rtl: false },
  { code: "pt", name: "Portuguese", nativeName: "Português",   rtl: false },
  { code: "nl", name: "Dutch",      nativeName: "Nederlands",  rtl: false },
  { code: "sv", name: "Swedish",    nativeName: "Svenska",     rtl: false },
] as const;

export type Language = {
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
};

export function getLangByCode(code: string): Language | undefined {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code) as Language | undefined;
}

/**
 * Get a word's translation in the requested language.
 * Checks extra_info.translations (new format) → inline translations field →
 * legacy english/persian columns → empty string.
 */
export function getTranslation(item: any, code: string): string {
  const t = item?.extra_info?.translations ?? item?.translations;
  if (t?.[code]) return t[code];
  if (code === "en" && item?.english) return item.english;
  if (code === "fa" && item?.persian) return item.persian;
  return "";
}

/** Same as getTranslation but for example sentences. */
export function getExampleTranslation(item: any, code: string): string {
  const t = item?.extra_info?.example_translations ?? item?.example_translations;
  if (t?.[code]) return t[code];
  if (code === "en" && item?.example_en) return item.example_en;
  if (code === "fa" && item?.example_fa) return item.example_fa;
  return "";
}
