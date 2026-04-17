import type { CoreApi } from '@editor/core';
import { DocumentsApi } from '@/api';
import { Syncable } from './sync';
import type { LayersManagerEvents } from '@editor/types/external/layers-events';

export class LayerSyncManager extends Syncable {
	private readonly _onLayerAdded: (e: LayersManagerEvents['layer::added']) => void;
	private readonly _onLayerUpdated: (e: LayersManagerEvents['layer::updated']) => void;
	private readonly _onLayerRemoved: (e: LayersManagerEvents['layer::removed']) => void;
	private readonly _onLayerActiveChanged: (e: LayersManagerEvents['layer::active::changed']) => void;
	private readonly _onLayerObjectOperation: (e: LayersManagerEvents['layer::object::op']) => void;
	private readonly _onLayerObjectAdded: (e: LayersManagerEvents['layer::object::added']) => void;
	private readonly _onLayerObjectMoved: (e: LayersManagerEvents['layer::object::moved']) => void;
	private readonly _onLayerObjectRemoved: (e: LayersManagerEvents['layer::object::removed']) => void;
	private readonly _onGroupAdded: (e: LayersManagerEvents['group::added']) => void;
	private readonly _onGroupRemoved: (e: LayersManagerEvents['group::removed']) => void;
	private readonly _onGroupUpdated: (e: LayersManagerEvents['group::updated']) => void;

	constructor(
		private coreApi: CoreApi,
		private documentApi: ReturnType<typeof DocumentsApi.withDocument>
	) {
		super();
		this._onLayerAdded = this.onLayerAdded.bind(this);
		this._onLayerUpdated = this.onLayerUpdated.bind(this);
		this._onLayerRemoved = this.onLayerRemoved.bind(this);
		this._onLayerActiveChanged = this.onLayerActiveChanged.bind(this);
		this._onLayerObjectOperation = this.onLayerObjectOperation.bind(this);
		this._onLayerObjectAdded = this.onLayerObjectAdded.bind(this);
		this._onLayerObjectMoved = this.onLayerObjectMoved.bind(this);
		this._onLayerObjectRemoved = this.onLayerObjectRemoved.bind(this);
		this._onGroupAdded = this.onGroupAdded.bind(this);
		this._onGroupRemoved = this.onGroupRemoved.bind(this);
		this._onGroupUpdated = this.onGroupUpdated.bind(this);
	}

	public start(): void {
		this.subscribeToLayerEvents();
	}
	public stop(): void {
		this.unsubscribeToLayerEvents();
	}

	private subscribeToLayerEvents(): void {
		const layersManager = this.coreApi.getLayersManager();
		layersManager.on('layer::added', this._onLayerAdded);
		layersManager.on('layer::updated', this._onLayerUpdated);
		layersManager.on('layer::removed', this._onLayerRemoved);
		layersManager.on('layer::active::changed', this._onLayerActiveChanged);

		layersManager.on('layer::object::op', this._onLayerObjectOperation);
		layersManager.on('layer::object::added', this._onLayerObjectAdded);
		layersManager.on('layer::object::moved', this._onLayerObjectMoved);
		layersManager.on('layer::object::removed', this._onLayerObjectRemoved);

		layersManager.on('group::added', this._onGroupAdded);
		layersManager.on('group::removed', this._onGroupRemoved);
		layersManager.on('group::updated', this._onGroupUpdated);
	}

	private unsubscribeToLayerEvents(): void {
		const layersManager = this.coreApi.getLayersManager();
		layersManager.off('layer::added', this._onLayerAdded);
		layersManager.off('layer::updated', this._onLayerUpdated);
		layersManager.off('layer::removed', this._onLayerRemoved);
		layersManager.off('layer::active::changed', this._onLayerActiveChanged);

		layersManager.off('layer::object::op', this._onLayerObjectOperation);
		layersManager.off('layer::object::added', this._onLayerObjectAdded);
		layersManager.off('layer::object::moved', this._onLayerObjectMoved);
		layersManager.off('layer::object::removed', this._onLayerObjectRemoved);

		layersManager.off('group::added', this._onGroupAdded);
		layersManager.off('group::removed', this._onGroupRemoved);
		layersManager.off('group::updated', this._onGroupUpdated);
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

	private onGroupAdded(event: LayersManagerEvents['group::added']): void {
		const { group } = event;
		this.documentApi.addGroup({
			id: group.id,
			name: group.name,
			collapsed: group.collapsed,
			parentId: group.parentId,
			index: group.index,
			opts: group.opts
		});
	}

	private onGroupRemoved(event: LayersManagerEvents['group::removed']): void {
		this.documentApi.removeGroup(event.id);
	}

	private onGroupUpdated(event: LayersManagerEvents['group::updated']): void {
		const { id } = event;
		const group = this.coreApi.getLayersManager().getGroup(id);
		if (!group) return;
		this.documentApi.updateGroup(id, {
			name: group.name,
			collapsed: group.collapsed,
			parentId: group.parentId,
			index: group.index,
			opts: group.opts
		});
	}
}
