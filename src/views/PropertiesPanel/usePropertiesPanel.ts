import { onDestroy } from 'svelte';
import { useCore } from '@/config/useCore';
import { PropertiesPanelController } from './PropertiesPanelController';

export const usePropertiesPanel = () => {
	const core = useCore();
	const controller = new PropertiesPanelController(core.getSelectionManager(), core.getHistoryManager());

	onDestroy(() => controller.destroy());

	return {
		descriptor: controller.descriptor,
		setProperty: (path: string, value: unknown, objectIds?: string[]) =>
			controller.setProperty(path, value, objectIds)
	};
};
