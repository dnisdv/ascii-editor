import { en } from './en';

const translations: Record<string, Record<string, string>> = {
	en
};

let currentLang = 'en';

export function t(key: string): string {
	return translations[currentLang][key] || key;
}

export function setLanguage(lang: string) {
	if (translations[lang]) {
		currentLang = lang;
	}
}
