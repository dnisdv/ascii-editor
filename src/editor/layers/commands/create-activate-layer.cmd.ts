import type { HistoryManager } from '@editor/history-manager';
import type { ILayersManagerInternalOps } from '../layers-manager';
import type { Layer } from '../layer';

export class CreateAndActivateLayerCommand {
	constructor(
		private managerOps: ILayersManagerInternalOps,
		private historyManager: HistoryManager
	) { }

	execute(): { id: string; layer: Layer } {
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

		return { id, layer };
	}
}
