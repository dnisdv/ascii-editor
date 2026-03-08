import type { ILayersManagerInternalOps } from '../layers-manager';
import type { LayerSerializer } from '@editor/types';
import type { LayerFactory } from '../layer-factory';
import type { LayersListManager } from '../layer-list-manager';
import type { HistoryManager } from '@editor/history-manager';
import type { Layer } from '../layer';

export class removeAndActivateLayerCommand {
	layerFactory: LayerFactory;
	layerSerializer: LayerSerializer;
	layersListManager: LayersListManager;

	constructor(
		private managerOps: ILayersManagerInternalOps,
		private historyManager: HistoryManager
	) {
		this.layerFactory = this.managerOps.getLayersFactory();
		this.layerSerializer = this.managerOps.getLayerSerializer();
		this.layersListManager = this.managerOps.getLayersListManager();
	}

	execute(id: string): Layer | null {
		const layer = this.layersListManager.getLayerById(id);
		if (!layer) return null;

		const beforeActiveKey = this.layersListManager.getActiveLayerKey();
		const { newActive } = this.layersListManager.removeLayerWithNewActive(layer.id);

		this.historyManager.applyAction(
			{
				type: 'layers::remove_and_activate',
				targetId: `layers`,
				before: { layer: this.layerSerializer.serialize(layer), activeKey: beforeActiveKey },
				after: { layer: null, activeKey: newActive || null }
			},
			{ applyAction: false }
		);

		return layer;
	}
}
