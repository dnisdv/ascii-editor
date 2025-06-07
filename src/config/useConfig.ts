import { getContext } from 'svelte';
import type { Readable } from 'svelte/store';
import type { Config } from '../editor/config';
import { EDITOR_CONFIG_CONTEXT_KEY } from './constants';

export interface EditorConfigContext {
	config: Config;
	configStore: Readable<Config>;
}
export const useConfig = (): EditorConfigContext => {
	const context = getContext<EditorConfigContext>(EDITOR_CONFIG_CONTEXT_KEY);
	if (!context) {
		throw new Error('useConfig() must be used within a <ConfigProvider>');
	}
	return context;
};
