import type { HistoryManager } from '@editor/history-manager';
import type { BaseBusLayers } from '@editor/bus-layers';
import type { ILayersManagerInternalOps } from '../layers-manager';
import type { ILayer } from '@editor/types';

export class CreateAndActivateLayerCommand {
	constructor(
		private managerOps: ILayersManagerInternalOps,
		private historyManager: HistoryManager,
		private bus: BaseBusLayers
	) {}

	execute(): { id: string; layer: ILayer } {
		const layerFactory = this.managerOps.getLayersFactory();
		const layerSerializer = this.managerOps.getLayerSerializer();

		const layersListManager = this.managerOps.getLayersListManager();

		const [id, layer] = layerFactory.createLayerWithDefaultConfig();

		const beforeId: string | null = layersListManager.getActiveLayer()?.id || null;
		layersListManager.addLayer(layer);
		layersListManager.setActiveLayer(layer.id);

		this.historyManager.applyAction(
			{
				type: 'layers::create_and_activate',
				targetId: 'layers',
				before: { layer: null, activeKey: beforeId },
				after: { layer: layerSerializer.serialize(layer), activeKey: id }
			},
			{ applyAction: false }
		);

		this.bus.emit('layer::create::response', {
			id,
			name: layer.name,
			index: layer.index,
			opts: layer.opts
		});

		this.managerOps.emit('layers::active::change', { oldId: beforeId, newId: id });
		this.bus.emit('layer::change_active::response', { id });
		return { id, layer };
	}
}
