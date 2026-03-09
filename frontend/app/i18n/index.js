'use client'
import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import ja from './locales/ja'
import en from './locales/en'

const dictionaries = { ja, en }
const SUPPORTED_LOCALES = ['ja', 'en']
const DEFAULT_LOCALE = 'ja'
const STORAGE_KEY = 'app-locale'

function detectLocale() {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && SUPPORTED_LOCALES.includes(stored)) return stored
    const browserLang = navigator.language?.slice(0, 2)
    if (SUPPORTED_LOCALES.includes(browserLang)) return browserLang
  }
  return DEFAULT_LOCALE
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE)

  useEffect(() => {
    setLocaleState(detectLocale())
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((newLocale) => {
    setLocaleState(newLocale)
    localStorage.setItem(STORAGE_KEY, newLocale)
  }, [])

  const t = useCallback((key, params) => {
    let str = dictionaries[locale]?.[key] ?? dictionaries[DEFAULT_LOCALE]?.[key] ?? key
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, v)
      })
    }
    return str
  }, [locale])

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext value={value}>{children}</I18nContext>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
