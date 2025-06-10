import type { Readable, Writable } from 'svelte/store';

export type ThemeVariables = {
	[key: string]: string;
} & {
	'--background': string;
	'--foreground': string;

	'--muted': string;
	'--muted-foreground': string;

	'--popover': string;
	'--popover-foreground': string;

	'--card': string;
	'--card-foreground': string;

	'--border': string;
	'--input': string;

	'--primary': string;
	'--primary-foreground': string;

	'--secondary': string;
	'--secondary-foreground': string;

	'--accent': string;
	'--accent-foreground': string;

	'--destructive': string;
	'--destructive-foreground': string;

	'--ring': string;
	'--radius': string;

	'--canvas-background': string;
};

export type CurrentThemeVariables = ThemeVariables;

export type Theme = 'light' | 'dark';
export type CssThemeVariables = { [key: string]: string };
export type RgbaThemeVariables = { [key: string]: [number, number, number, number] };
export type HexThemeVariables = { [key: string]: string };
export type Themes = { light: CssThemeVariables; dark: CssThemeVariables };

export interface ThemeContext {
	theme: Writable<Theme>;
	themes: Writable<Themes>;
	currentTheme: Readable<CssThemeVariables>;
	currentThemeRGBA: Readable<RgbaThemeVariables>;
	currentThemeHEX: Readable<HexThemeVariables>;
	setTheme: (value: Theme) => void;
	toggleTheme: () => void;
}
