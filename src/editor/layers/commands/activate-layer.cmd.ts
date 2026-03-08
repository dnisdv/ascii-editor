import type { ILayersManagerInternalOps } from '../layers-manager';
import type { LayerFactory } from '../layer-factory';
import type { LayersListManager } from '../layer-list-manager';
import type { HistoryManager } from '@editor/history-manager';

export class activateLayerCommand {
	layerFactory: LayerFactory;
	layersListManager: LayersListManager;

	constructor(
		private managerOps: ILayersManagerInternalOps,
		private historyManager: HistoryManager
	) {
		this.layerFactory = this.managerOps.getLayersFactory();
		this.layersListManager = this.managerOps.getLayersListManager();
	}

	execute(id: string): void {
		const beforeId: string | null = this.layersListManager.getActiveLayer()?.id || null;

		this.historyManager.applyAction({
			type: 'layers::change::active',
			targetId: `layers`,
			before: { id: beforeId },
			after: { id: id }
		});
	}
}
