import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import all translation files
import enCommon from './locales/en/common.json'
import enSettings from './locales/en/settings.json'
import enExplorer from './locales/en/explorer.json'
import enEditor from './locales/en/editor.json'
import enTerminal from './locales/en/terminal.json'
import enDialogs from './locales/en/dialogs.json'
import enAbout from './locales/en/about.json'
import enGit from './locales/en/git.json'
import enUpdate from './locales/en/update.json'
import enVoice from './locales/en/voice.json'

// Combine all English translations
const enResources = {
  common: enCommon,
  settings: enSettings,
  explorer: enExplorer,
  editor: enEditor,
  terminal: enTerminal,
  dialogs: enDialogs,
  about: enAbout,
  git: enGit,
  update: enUpdate,
  voice: enVoice,
}

// Language resources
const resources = {
  en: enResources,
  // zh-CN will be added later
}

// Available languages for the language switcher
// Only include languages that have translation resources in the 'resources' object above
export const availableLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  // { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' }, // TODO: Add when zh-CN translations are ready
] as const

export type LanguageCode = (typeof availableLanguages)[number]['code']

// Initialize i18next
i18n
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    resources,
    fallbackLng: 'en', // Fallback to English if language not available
    defaultNS: 'common', // Default namespace
    ns: ['common', 'settings', 'explorer', 'editor', 'terminal', 'dialogs', 'about', 'git', 'update', 'voice'],

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    detection: {
      // Order of language detection
      order: ['localStorage', 'navigator'],
      // Cache user language preference
      caches: ['localStorage'],
      // LocalStorage key
      lookupLocalStorage: 'aiter-language',
    },

    react: {
      useSuspense: false, // Disable suspense for compatibility
    },
  })

// Helper function to change language
export const changeLanguage = async (lng: LanguageCode): Promise<void> => {
  await i18n.changeLanguage(lng)
  localStorage.setItem('aiter-language', lng)
}

// Helper function to get current language
export const getCurrentLanguage = (): string => {
  return i18n.language || 'en'
}

export default i18n
