import { getContext } from 'svelte';
import { THEME_CONTEXT_KEY } from './constants';
import type { ThemeContext } from './types';

export const useTheme = (): ThemeContext => {
	const theme = getContext<ThemeContext>(THEME_CONTEXT_KEY);

	if (!theme) {
		throw new Error('useTheme must be used within a ThemeProvider');
	}

	return theme;
};
