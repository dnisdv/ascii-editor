import type { CoreApi } from '@editor/core';
import { DocumentsApi } from '@/api';
import { Syncable } from './sync';
import type { LayersManagerEvents } from '@editor/types/external/layers-events';

export class LayerSyncManager extends Syncable {
	constructor(
		private coreApi: CoreApi,
		private documentApi: ReturnType<typeof DocumentsApi.withDocument>
	) {
		super();
	}

	public start(): void {
		this.subscribeToLayerEvents();
	}
	public stop(): void {
		this.unsubscribeToLayerEvents();
	}

	private subscribeToLayerEvents(): void {
		const layersManager = this.coreApi.getLayersManager();
		layersManager.on('layer::added', this.onLayerAdded.bind(this));
		layersManager.on('layer::updated', this.onLayerUpdated.bind(this));
		layersManager.on('layer::removed', this.onLayerRemoved.bind(this));
		layersManager.on('layer::active::changed', this.onLayerActiveChanged.bind(this));

		layersManager.on('layer::object::op', this.onLayerObjectOperation.bind(this));
		layersManager.on('layer::object::added', this.onLayerObjectAdded.bind(this));
		layersManager.on('layer::object::moved', this.onLayerObjectMoved.bind(this));
		layersManager.on('layer::object::removed', this.onLayerObjectRemoved.bind(this));
	}

	private unsubscribeToLayerEvents(): void {
		const layersManager = this.coreApi.getLayersManager();
		layersManager.off('layer::added', this.onLayerAdded.bind(this));
		layersManager.off('layer::updated', this.onLayerUpdated.bind(this));
		layersManager.off('layer::removed', this.onLayerRemoved.bind(this));
		layersManager.off('layer::active::changed', this.onLayerActiveChanged.bind(this));

		layersManager.off('layer::object::op', this.onLayerObjectOperation.bind(this));
		layersManager.off('layer::object::added', this.onLayerObjectAdded.bind(this));
		layersManager.off('layer::object::moved', this.onLayerObjectMoved.bind(this));
		layersManager.off('layer::object::removed', this.onLayerObjectRemoved.bind(this));
	}

	private onLayerAdded(event: LayersManagerEvents['layer::added']) {
		const layerSerializer = this.coreApi.getSerializer().layerSerializer;
		const serializedLayer = layerSerializer.serialize(event.layer);
		this.documentApi.addLayer(serializedLayer);
	}

	private onLayerRemoved(event: LayersManagerEvents['layer::removed']): void {
		this.documentApi.removeLayer(event.id);
	}

	private onLayerUpdated(event: LayersManagerEvents['layer::updated']): void {
		const { layerId, ...updates } = event;
		this.documentApi.updateLayer({ id: layerId, ...updates });
	}

	private onLayerActiveChanged(event: LayersManagerEvents['layer::active::changed']): void {
		this.documentApi.setActiveLayer(event.newId);
	}

	private onLayerObjectOperation(event: LayersManagerEvents['layer::object::op']): void {
		const { layerId, objectId, objectType, operation } = event;
		this.documentApi.updateSmartObject(layerId, objectId, objectType, operation);
	}

	private onLayerObjectRemoved(event: LayersManagerEvents['layer::object::removed']): void {
		this.documentApi.removeSmartObject(event.layerId, event.id);
	}

	private onLayerObjectAdded(event: LayersManagerEvents['layer::object::added']): void {
		this.documentApi.addSmartObject(
			event.layerId,
			event.object.id,
			event.object.type,
			event.toIndex,
			event.object.serialize(),
			event.orderKey
		);
	}

	private onLayerObjectMoved(event: LayersManagerEvents['layer::object::moved']): void {
		this.documentApi.moveSmartObject(event.layerId, event.id, event.toIndex, event.orderKey);
	}
}
