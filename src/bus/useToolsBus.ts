import { getContext } from 'svelte';
import { EDITOR_PLUGINS_BUS_KEY } from './config';
import type { EditorToolsBus } from './editor-tools.bus';

export const useToolBus = (): EditorToolsBus => {
	const bus: EditorToolsBus = getContext(EDITOR_PLUGINS_BUS_KEY);
	return bus;
};
