import type { ILayersManagerInternalOps } from '../layers-manager';
import type { DeepPartial, LayerSerializer } from '@editor/types';
import type { LayerFactory } from '../layer-factory';
import type { LayersListManager } from '../layer-list-manager';
import type { HistoryManager } from '@editor/history-manager';
import type { ILayerModel } from '@editor/types/external/layer-model';

export class updateLayerCommand {
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

	execute(id: string, updates: DeepPartial<ILayerModel>): void {
		const beforeLayer = this.layersListManager.getLayerById(id);
		if (!beforeLayer) return;

		const beforeData = this.layerSerializer.serialize(beforeLayer);
		this.layersListManager.updateLayer(id, updates);

		this.historyManager.applyAction(
			{
				type: 'layer::update',
				targetId: `layers`,
				before: beforeData,
				after: this.layerSerializer.serialize(this.layersListManager.getLayerById(id)!)
			},
			{ applyAction: false }
		);

		this.managerOps.emit('layer::updated');
	}
}
