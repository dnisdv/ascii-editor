import type { CoreApi } from './core';

const HIDDEN_LAYER_CODE = 'LAYER_HIDDEN';

export const RequireActiveLayerVisible = (coreApi: CoreApi, tool: string) => ({
	code: HIDDEN_LAYER_CODE,
	condition: (): boolean => {
		const layer = coreApi.getLayersManager().getActiveLayer();
		if (!layer) return true;
		return layer?.opts.visible || false;
	},
	message: `Layer must be visible to edit text, ${tool}`,
	type: 'requirement',
	actions: [
		{
			label: 'Show Layer',
			callback: () => {
				const layer = coreApi.getLayersManager().getActiveLayer();
				if (!layer) return false;

				const layerManager = coreApi.getLayersManager();
				layerManager.updateLayer(layer.id, { opts: { visible: true } });
			}
		}
	],
	subscribe: (callback: () => void) => {
		const layerBus = coreApi.getBusManager().layers;
		layerBus.on('layer::change_active::response', callback);
		layerBus.on('layer::update::response', callback);
		layerBus.on('layer::remove::response', callback);

		return () => {
			layerBus.off('layer::change_active::response', callback);
			layerBus.off('layer::update::response', callback);
			layerBus.off('layer::remove::response', callback);
		};
	}
});

export const RequireActiveLayerExist = (coreApi: CoreApi) => ({
	code: HIDDEN_LAYER_CODE,
	condition: (): boolean => {
		const layer = coreApi.getLayersManager().getActiveLayer();
		return !!layer?.id || false;
	},
	message: 'No active layer found',
	type: 'warning',
	actions: [
		{
			label: 'Create an layer',
			callback: () => {
				coreApi.getLayersManager().ensureLayer();
			}
		}
	]
});
