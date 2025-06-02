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

export interface Themes {
	light: ThemeVariables;
	dark: ThemeVariables;
}

export type Theme = 'light' | 'dark';
export type CurrentThemeVariables = ThemeVariables;

export interface ThemeContext {
	theme: Writable<Theme>;
	themes: Writable<Themes>;
	currentTheme: Readable<CurrentThemeVariables>;
	currentThemeHEX: Readable<CurrentThemeVariables>;
	currentThemeRGBA: Readable<CurrentThemeVariables>;
	setTheme: (theme: Theme) => void;
	toggleTheme: () => void;
}
