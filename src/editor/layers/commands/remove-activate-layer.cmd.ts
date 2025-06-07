import type { ILayersManagerInternalOps } from '../layers-manager';
import type { ILayer, LayerSerializer } from '@editor/types';
import type { LayerFactory } from '../layer-factory';
import type { LayersListManager } from '../layer-list-manager';
import type { HistoryManager } from '@editor/history-manager';
import type { BaseBusLayers } from '@editor/bus-layers';

export class removeAndActivateLayerCommand {
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

	execute(id: string): ILayer | null {
		const layer = this.layersListManager.getLayerById(id);
		if (!layer) return null;

		const beforeActiveKey = this.layersListManager.getActiveLayerKey();

		this.managerOps.emit('layer::remove::before');
		const { newActive } = this.layersListManager.removeLayerWithNewActive(layer.id);

		this.bus.emit('layer::remove::response', { id });

		this.bus.emit('layer::change_active::response', { id: newActive || null });
		this.historyManager.applyAction({
			type: 'layers::remove_and_activate',
			targetId: `layers`,
			before: { layer: this.layerSerializer.serialize(layer), activeKey: beforeActiveKey },
			after: { layer: null, activeKey: newActive || null }
		});
		this.managerOps.emit('layer::remove::after');
		return layer;
	}
}
