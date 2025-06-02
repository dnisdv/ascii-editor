import { getContext } from 'svelte';
import type { EditorLayersBus } from './editor-layers.bus';
import { EDITOR_LAYERS_BUS_KEY } from './config';

export const useLayerBus = (): EditorLayersBus => {
	const bus: EditorLayersBus = getContext(EDITOR_LAYERS_BUS_KEY);
	return bus;
};
