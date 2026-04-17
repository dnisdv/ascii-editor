import type { DeepPartial } from '@editor/types';
import { EventEmitter } from '@editor/event-emitter';
import type { LayersListManagerEvents } from '@editor/types/external/layers-events';
import type { Layer } from './layer';
import type { ILayerModel } from '@editor/types/external/layer-model';
import { ScopeIndexAllocator } from './scope-index-allocator';

export class LayersListManager extends EventEmitter<LayersListManagerEvents> {
	private layers: Map<string, Layer>;
	private layerIds: string[];
	private activeLayerKey: string | null;
	private scopeIndex: ScopeIndexAllocator;

	constructor(scopeIndex: ScopeIndexAllocator, layers: Layer[] = []) {
		super();
		this.layers = new Map();
		this.layerIds = [];
		this.activeLayerKey = null;
		this.scopeIndex = scopeIndex;

		if (layers.length > 0) this.addMultipleLayers(layers);
	}

	public addLayer(layer: Layer): void {
		const layerId = layer.id;
		this.layers.set(layerId, layer);

		const existingIndex = this.layerIds.indexOf(layerId);
		if (existingIndex > -1) {
			this.layerIds.splice(existingIndex, 1);
		}

		this.layerIds.push(layerId);

		const groupId = layer.groupId ?? null;
		layer.update({ index: this.scopeIndex!.next(groupId, layerId) });

		this.emit('layer::added', { layer });
	}

	public insertLayerAtIndex(layer: Layer, index: number): void {
		const layerId = layer.id;

		const oldIndex = this.layerIds.indexOf(layerId);
		if (oldIndex !== -1) {
			this.layerIds.splice(oldIndex, 1);
		}

		this.layers.set(layerId, layer);

		const effectiveIndex = Math.max(0, Math.min(index, this.layerIds.length));
		this.layerIds.splice(effectiveIndex, 0, layerId);

		this.emit('layer::added', { layer });
	}

	public addMultipleLayers(layersToAdd: Layer[]): void {
		if (layersToAdd.length === 0) return;

		layersToAdd.forEach((layer) => {
			const layerId = layer.id;
			this.layers.set(layerId, layer);

			const existingIndex = this.layerIds.indexOf(layerId);
			if (existingIndex > -1) {
				this.layerIds.splice(existingIndex, 1);
			}
			this.layerIds.push(layerId);

			// Auto-assign scope-local index
			const groupId = layer.groupId ?? null;
			layer.update({ index: this.scopeIndex!.next(groupId, layerId) });

			this.emit('layer::added', { layer });
		});
	}

	public removeLayer(layerId: string) {
		const index = this.layerIds.indexOf(layerId);
		if (index === -1) {
			if (this.layers.has(layerId)) {
				this.layers.delete(layerId);
				if (this.activeLayerKey === layerId) {
					this.activeLayerKey = this.layerIds[0] || null;
				}
			}
			return;
		}
		this.layers.delete(layerId);
		this.layerIds.splice(index, 1);
		this.emit('layer::removed', { id: layerId });
	}

	public removeLayerWithNewActive(layerId: string): {
		removed: boolean;
		newActive?: string | null;
	} {
		const index = this.layerIds.indexOf(layerId);
		if (index === -1) {
			if (this.layers.has(layerId)) {
				this.layers.delete(layerId);
				if (this.activeLayerKey === layerId) {
					this.activeLayerKey = this.layerIds[0] || null;
				}
			}
			return { removed: false };
		}

		this.layers.delete(layerId);
		this.layerIds.splice(index, 1);
		this.emit('layer::removed', { id: layerId });

		let newActiveKey = this.activeLayerKey;
		if (this.activeLayerKey === layerId) {
			newActiveKey = this.layerIds[index] || this.layerIds[index - 1] || null;
			this.setActiveLayer(newActiveKey);
		}

		return { removed: true, newActive: newActiveKey };
	}

	public moveLayerToPosition(layerId: string, newIndex: number): boolean {
		const currentIndex = this.layerIds.indexOf(layerId);
		if (currentIndex === -1) return false;

		this.layerIds.splice(currentIndex, 1);
		const effectiveNewIndex = Math.max(0, Math.min(newIndex, this.layerIds.length));
		this.layerIds.splice(effectiveNewIndex, 0, layerId);

		const layer = this.layers.get(layerId);
		if (layer) layer.update({ index: newIndex });

		return true;
	}

	public updateLayer(
		layerId: string,
		updates: DeepPartial<ILayerModel>
	): {
		success: boolean;
	} {
		const layer = this.layers.get(layerId);
		if (!layer) {
			return { success: false };
		}

		const autoIndex = this.scopeIndex.nextOnScopeChange(updates.groupId, layer.groupId ?? null, updates.index, layerId);
		if (autoIndex !== undefined) updates = { ...updates, index: autoIndex };

		layer.update(updates);
		return { success: true };
	}

	public getLayerById(layerId: string): Layer | undefined {
		return this.layers.get(layerId);
	}

	public getSortedLayers(): Layer[] {
		return this.layerIds
			.map((id) => this.layers.get(id))
			.filter((layer) => layer !== undefined);
	}

	public getFirstLayer(): Layer | undefined {
		return this.layers.get(this.layerIds[0]);
	}

	public hasLayer(layerId: string): boolean {
		return this.layers.has(layerId);
	}

	public clear(): void {
		this.layers.forEach((layer) => this.emit('layer::removed', { id: layer.id }));
		this.layers.clear();
		this.layerIds = [];
		this.activeLayerKey = null;
	}

	public getActiveLayer(): Layer | null {
		return this.activeLayerKey ? this.layers.get(this.activeLayerKey) || null : null;
	}

	public setActiveLayer(layerId: string | null): boolean {
		if (layerId === null || !layerId) {
			if (this.activeLayerKey !== null) {
				const oldId = this.activeLayerKey;
				this.activeLayerKey = null;
				this.emit('layer::active::changed', { oldId, newId: null });
			}
			return true;
		}

		if (!this.layers.has(layerId)) {
			return false;
		}

		if (this.activeLayerKey !== layerId) {
			const oldId = this.activeLayerKey;
			this.activeLayerKey = layerId;
			this.emit('layer::active::changed', { oldId, newId: layerId });
		}
		return true;
	}

	public getActiveLayerKey(): string | null {
		return this.activeLayerKey;
	}
}
