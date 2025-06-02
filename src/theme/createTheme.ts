import { writable, derived } from 'svelte/store';
import type { Theme, Themes, ThemeVariables, ThemeContext } from './types';

function hslToNormalizedRgbaArray(value: string): string {
	const hslRegex = /^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+))?$/;
	const match = value.match(hslRegex);
	if (!match) return value;

	let h = parseFloat(match[1]);
	const s = parseFloat(match[2]) / 100;
	const l = parseFloat(match[3]) / 100;
	const a = match[4] ? parseFloat(match[4]) : 1;

	h = h % 360;
	if (h < 0) h += 360;

	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;

	let r = 0,
		g = 0,
		b = 0;

	if (0 <= h && h < 60) [r, g, b] = [c, x, 0];
	else if (60 <= h && h < 120) [r, g, b] = [x, c, 0];
	else if (120 <= h && h < 180) [r, g, b] = [0, c, x];
	else if (180 <= h && h < 240) [r, g, b] = [0, x, c];
	else if (240 <= h && h < 300) [r, g, b] = [x, 0, c];
	else if (300 <= h && h < 360) [r, g, b] = [c, 0, x];

	const rInt = Math.round((r + m) * 255);
	const gInt = Math.round((g + m) * 255);
	const bInt = Math.round((b + m) * 255);

	return `rgba(${rInt}, ${gInt}, ${bInt}, ${a})`;
}

function hslToHex(value: string): string {
	const hslRegex = /^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+))?$/;
	const match = value.match(hslRegex);
	if (!match) return value;

	let h = parseFloat(match[1]);
	const s = parseFloat(match[2]) / 100;
	const l = parseFloat(match[3]) / 100;
	const a = match[4] ? parseFloat(match[4]) : 1;

	h = h % 360;
	if (h < 0) h += 360;

	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;

	let r = 0,
		g = 0,
		b = 0;
	if (0 <= h && h < 60) {
		r = c;
		g = x;
		b = 0;
	} else if (60 <= h && h < 120) {
		r = x;
		g = c;
		b = 0;
	} else if (120 <= h && h < 180) {
		r = 0;
		g = c;
		b = x;
	} else if (180 <= h && h < 240) {
		r = 0;
		g = x;
		b = c;
	} else if (240 <= h && h < 300) {
		r = x;
		g = 0;
		b = c;
	} else if (300 <= h && h < 360) {
		r = c;
		g = 0;
		b = x;
	}

	const red = Math.round((r + m) * 255);
	const green = Math.round((g + m) * 255);
	const blue = Math.round((b + m) * 255);

	const hexR = red.toString(16).padStart(2, '0');
	const hexG = green.toString(16).padStart(2, '0');
	const hexB = blue.toString(16).padStart(2, '0');

	if (a === 1) {
		return `#${hexR}${hexG}${hexB}`;
	} else {
		const alphaInt = Math.round(a * 255);
		const hexA = alphaInt.toString(16).padStart(2, '0');
		return `#${hexR}${hexG}${hexB}${hexA}`;
	}
}

function parseThemes(): Themes {
	const themes: Themes = { light: {} as ThemeVariables, dark: {} as ThemeVariables };
	if (typeof window === 'undefined') return themes;

	const isStyleRule = (rule: CSSRule): rule is CSSStyleRule => rule instanceof CSSStyleRule;

	Array.from(document.styleSheets).forEach((sheet) => {
		try {
			Array.from(sheet.cssRules).forEach((rule) => {
				if (!isStyleRule(rule)) return;

				if (rule.selectorText === ':root') {
					parseRule(rule, themes.light);
				} else if (rule.selectorText === '.dark') {
					parseRule(rule, themes.dark);
				}
			});
		} catch (e) {
			console.warn('Error reading stylesheet:', e);
		}
	});

	return themes;
}

function parseRule(rule: CSSStyleRule, themeObj: ThemeVariables): void {
	Array.from(rule.style).forEach((prop) => {
		if (prop.startsWith('--')) {
			themeObj[prop] = rule.style.getPropertyValue(prop).trim();
		}
	});
}

export function createTheme(): ThemeContext {
	const theme = writable<Theme>('light');
	const themes = writable<Themes>({ light: {} as ThemeVariables, dark: {} as ThemeVariables });
	const currentTheme = derived(
		[theme, themes],
		([$theme, $themes]) => $themes[$theme] || ({} as ThemeVariables)
	);

	const currentThemeRGBA = derived(currentTheme, ($theme) => {
		const converted: ThemeVariables = {} as ThemeVariables;
		for (const [key, value] of Object.entries($theme)) {
			const convertedValue = hslToNormalizedRgbaArray(value);
			converted[key] = convertedValue;
		}
		return converted;
	});

	const currentThemeHEX = derived(currentTheme, ($theme) => {
		const converted: ThemeVariables = {} as ThemeVariables;
		for (const [key, value] of Object.entries($theme)) {
			converted[key] = hslToHex(value);
		}
		return converted;
	});

	themes.set(parseThemes());
	const initialTheme = (localStorage.getItem('theme') as Theme) || 'dark';
	document.body.classList.toggle('dark', initialTheme === 'dark');
	theme.set(initialTheme);

	theme.subscribe((newTheme) => {
		document.body.classList.toggle('dark', newTheme === 'dark');
		localStorage.setItem('theme', newTheme);
	});

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
