import { writable, derived, type Readable } from 'svelte/store';
import type {
	CssThemeVariables,
	HexThemeVariables,
	RgbaThemeVariables,
	Theme,
	ThemeContext,
	Themes
} from './types';

function parseHslString(value: string): [number, number, number, number] | null {
	if (typeof value !== 'string') return null;
	const hslRegex = /^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+))?$/;
	const match = value.match(hslRegex);
	if (!match) return null;

	const h = parseFloat(match[1]);
	const s = parseFloat(match[2]) / 100;
	const l = parseFloat(match[3]) / 100;
	const a = match[4] ? parseFloat(match[4]) : 1.0;

	return [h, s, l, a];
}

function hslToNormalizedRgbaArray(
	h: number,
	s: number,
	l: number,
	a = 1.0
): [number, number, number, number] {
	s = Math.max(0, Math.min(1, s));
	l = Math.max(0, Math.min(1, l));

	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	let r = 0,
		g = 0,
		b = 0;

	if (h >= 0 && h < 60) {
		r = c;
		g = x;
		b = 0;
	} else if (h >= 60 && h < 120) {
		r = x;
		g = c;
		b = 0;
	} else if (h >= 120 && h < 180) {
		r = 0;
		g = c;
		b = x;
	} else if (h >= 180 && h < 240) {
		r = 0;
		g = x;
		b = c;
	} else if (h >= 240 && h < 300) {
		r = x;
		g = 0;
		b = c;
	} else if (h >= 300 && h < 360) {
		r = c;
		g = 0;
		b = x;
	}

	return [r + m, g + m, b + m, a];
}

function hslToHex(value: string): string {
	const hsl = parseHslString(value);
	if (!hsl) return value;

	const [h, s, l, a] = hsl;
	const [rNorm, gNorm, bNorm] = hslToNormalizedRgbaArray(h, s, l);

	const toHex = (c: number) =>
		Math.round(c * 255)
			.toString(16)
			.padStart(2, '0');

	const hexR = toHex(rNorm);
	const hexG = toHex(gNorm);
	const hexB = toHex(bNorm);

	if (a === 1) {
		return `#${hexR}${hexG}${hexB}`;
	} else {
		const hexA = toHex(a);
		return `#${hexR}${hexG}${hexB}${hexA}`;
	}
}

function parseThemes(): Themes {
	const themes: Themes = { light: {}, dark: {} };
	if (typeof window === 'undefined') return themes;

	for (const sheet of Array.from(document.styleSheets)) {
		try {
			for (const rule of Array.from(sheet.cssRules)) {
				if (!(rule instanceof CSSStyleRule)) continue;

				if (rule.selectorText === ':root') {
					parseRule(rule, themes.light);
				} else if (rule.selectorText === '.dark') {
					parseRule(rule, themes.dark);
				}
			}
		} catch (e) {
			console.warn(`Could not read CSS rules from stylesheet: ${sheet.href || 'inline sheet'}.`, e);
		}
	}
	return themes;
}

function parseRule(rule: CSSStyleRule, themeObj: CssThemeVariables): void {
	for (const prop of Array.from(rule.style)) {
		if (prop.startsWith('--')) {
			themeObj[prop] = rule.style.getPropertyValue(prop).trim();
		}
	}
}

export function createTheme(): ThemeContext {
	const theme = writable<Theme>('light');
	const themes = writable<Themes>({ light: {}, dark: {} });

	const currentTheme: Readable<CssThemeVariables> = derived(
		[theme, themes],
		([$theme, $themes]) => $themes[$theme] || {}
	);

	const currentThemeRGBA: Readable<RgbaThemeVariables> = derived(currentTheme, ($theme) => {
		const converted: RgbaThemeVariables = {};
		for (const [key, value] of Object.entries($theme)) {
			const hslParts = parseHslString(value);
			if (hslParts) {
				converted[key] = hslToNormalizedRgbaArray(...hslParts);
			}
		}
		return converted;
	});

	const currentThemeHEX: Readable<HexThemeVariables> = derived(currentTheme, ($theme) => {
		const converted: HexThemeVariables = {};
		for (const [key, value] of Object.entries($theme)) {
			converted[key] = hslToHex(value);
		}
		return converted;
	});

	if (typeof window !== 'undefined') {
		themes.set(parseThemes());
		const initialTheme = (localStorage.getItem('theme') as Theme) || 'dark';
		document.body.classList.toggle('dark', initialTheme === 'dark');
		theme.set(initialTheme);

		theme.subscribe((newTheme) => {
			document.body.classList.toggle('dark', newTheme === 'dark');
			localStorage.setItem('theme', newTheme);
		});
	}

	return {
		theme,
		themes,
		currentTheme,
		currentThemeRGBA,
		currentThemeHEX,
		setTheme: theme.set,
		toggleTheme: () => theme.update((current) => (current === 'dark' ? 'light' : 'dark'))
	};
}
