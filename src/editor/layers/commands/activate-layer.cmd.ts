import type { ILayersManagerInternalOps } from '../layers-manager';
import type { LayerSerializer } from '@editor/types';
import type { LayerFactory } from '../layer-factory';
import type { LayersListManager } from '../layer-list-manager';
import type { HistoryManager } from '@editor/history-manager';
import type { BaseBusLayers } from '@editor/bus-layers';

export class activateLayerCommand {
	layerFactory: LayerFactory;
	layerSerializer: LayerSerializer;
	layersListManager: LayersListManager;

	constructor(
		private managerOps: ILayersManagerInternalOps,
		private historyManager: HistoryManager,
		private bus: BaseBusLayers
	) {
		this.layerFactory = this.managerOps.getLayersFactory();
		this.layerSerializer = this.managerOps.getLayerSerializer();
		this.layersListManager = this.managerOps.getLayersListManager();
	}

	execute(id: string): void {
		const beforeId: string | null = this.layersListManager.getActiveLayer()?.id || null;

		this.managerOps.emit('layers::active::change', { oldId: beforeId, newId: id });
		this.bus.emit('layer::change_active::response', { id });

		this.historyManager.applyAction({
			type: 'layers::change::active',
			targetId: `layers`,
			before: { id: beforeId },
			after: { id: id }
		});
	}
}
