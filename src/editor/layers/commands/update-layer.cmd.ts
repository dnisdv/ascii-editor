import type { ILayersManagerInternalOps } from '../layers-manager';
import type { DeepPartial, ILayerModel, LayerSerializer } from '@editor/types';
import type { LayerFactory } from '../layer-factory';
import type { LayersListManager } from '../layer-list-manager';
import type { HistoryManager } from '@editor/history-manager';
import type { BaseBusLayers } from '@editor/bus-layers';

export class updateLayerCommand {
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

	execute(id: string, updates: DeepPartial<ILayerModel>): void {
		const beforeLayer = this.layersListManager.getLayerById(id);
		if (!beforeLayer) return;

		const beforeData = this.layerSerializer.serialize(beforeLayer);

		const res = this.layersListManager.updateLayer(id, updates);
		if (res.success && res.beforeAfter) {
			this.bus.emit('layer::update::response', res.beforeAfter.after);
		}

		if (res.reindexed) {
			this.bus.emit('layers::update::response', res.reindexed);
		}

		this.historyManager.applyAction(
			{
				type: 'layer::update',
				targetId: `layers`,
				before: beforeData,
				after: this.layerSerializer.serialize(this.layersListManager.getLayerById(id)!)
			},
			{ applyAction: false }
		);

		this.managerOps.emit('layer::update::model');
	}
}
