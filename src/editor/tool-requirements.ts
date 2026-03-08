import type { CoreApi } from './core';

const HIDDEN_LAYER_CODE = 'LAYER_HIDDEN';

export const RequireActiveLayerVisible = (coreApi: CoreApi, tool: string) => ({
	code: HIDDEN_LAYER_CODE,
	condition: (): boolean => {
		const layer = coreApi.getLayersManager().getActiveLayer();
		if (!layer) return true;
		return layer?.opts.visible || false;
	},
	message: `Layer must be visible`,
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
		void tool;
		const layersManager = coreApi.getLayersManager();
		layersManager.on('layer::active::changed', callback);
		layersManager.on('layer::updated', callback);

		return () => {
			layersManager.off('layer::active::changed', callback);
			layersManager.off('layer::updated', callback);
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
