import type { DeepPartial } from '@editor/types';
import { EventEmitter } from '@editor/event-emitter';
import type { LayersListManagerEvents } from '@editor/types/external/layers-events';
import type { Layer } from './layer';
import type { ILayerModel } from '@editor/types/external/layer-model';

export class LayersListManager extends EventEmitter<LayersListManagerEvents> {
	private layers: Map<string, Layer>;
	private sortedLayerIds: string[];
	private activeLayerKey: string | null;

	constructor(layers: Layer[] = []) {
		super();
		this.layers = new Map();
		this.sortedLayerIds = [];
		this.activeLayerKey = null;

		if (layers.length > 0) this.addMultipleLayers(layers);
		this.reindexLayers();
	}

	private reindexLayers(): { id: string; index: number }[] {
		const reindexedLayers: { id: string; index: number }[] = [];

		this.sortedLayerIds.forEach((id, index) => {
			const layer = this.layers.get(id);
			if (layer) {
				layer.update({ index });
				reindexedLayers.push({ id, index });
			}
		});

		return reindexedLayers;
	}

	public addLayer(layer: Layer): void {
		const layerId = layer.id;
		this.layers.set(layerId, layer);

		const existingIndex = this.sortedLayerIds.indexOf(layerId);
		if (existingIndex > -1) {
			this.sortedLayerIds.splice(existingIndex, 1);
		}

		this.sortedLayerIds.push(layerId);
		this.reindexLayers();
		this.emit('layer::added', { layer });
	}

	public insertLayerAtIndex(layer: Layer, index: number): { id: string; index: number }[] {
		const layerId = layer.id;

		const oldIndex = this.sortedLayerIds.indexOf(layerId);
		if (oldIndex !== -1) {
			this.sortedLayerIds.splice(oldIndex, 1);
		}

		this.layers.set(layerId, layer);

		const effectiveIndex = Math.max(0, Math.min(index, this.sortedLayerIds.length));
		this.sortedLayerIds.splice(effectiveIndex, 0, layerId);
		const reindexed = this.reindexLayers();
		this.emit('layer::added', { layer });
		return reindexed;
	}

	public addMultipleLayers(layersToAdd: Layer[]): void {
		if (layersToAdd.length === 0) return;

		layersToAdd.forEach((layer) => {
			const layerId = layer.id;
			this.layers.set(layerId, layer);

			const existingIndex = this.sortedLayerIds.indexOf(layerId);
			if (existingIndex > -1) {
				this.sortedLayerIds.splice(existingIndex, 1);
			}
			this.sortedLayerIds.push(layerId);
			this.emit('layer::added', { layer });
		});

		this.reindexLayers();
	}

	public removeLayer(layerId: string) {
		const index = this.sortedLayerIds.indexOf(layerId);
		if (index === -1) {
			if (this.layers.has(layerId)) {
				this.layers.delete(layerId);
				if (this.activeLayerKey === layerId) {
					this.activeLayerKey = this.sortedLayerIds[0] || null;
				}
			}
			return;
		}
		this.layers.delete(layerId);
		this.sortedLayerIds.splice(index, 1);
		this.emit('layer::removed', { id: layerId });
		this.reindexLayers();
	}

	public removeLayerWithNewActive(layerId: string): {
		removed: boolean;
		newActive?: string | null;
	} {
		const index = this.sortedLayerIds.indexOf(layerId);
		if (index === -1) {
			if (this.layers.has(layerId)) {
				this.layers.delete(layerId);
				if (this.activeLayerKey === layerId) {
					this.activeLayerKey = this.sortedLayerIds[0] || null;
				}
			}
			return { removed: false };
		}

		this.layers.delete(layerId);
		this.sortedLayerIds.splice(index, 1);
		this.emit('layer::removed', { id: layerId });

		let newActiveKey = this.activeLayerKey;
		if (this.activeLayerKey === layerId) {
			newActiveKey = this.sortedLayerIds[index] || this.sortedLayerIds[index - 1] || null;
			this.setActiveLayer(newActiveKey);
		}

		this.reindexLayers();
		return { removed: true, newActive: newActiveKey };
	}

	public moveLayerToPosition(layerId: string, newIndex: number): boolean {
		const currentIndex = this.sortedLayerIds.indexOf(layerId);
		if (currentIndex === -1) return false;

		this.sortedLayerIds.splice(currentIndex, 1);
		const effectiveNewIndex = Math.max(0, Math.min(newIndex, this.sortedLayerIds.length));
		this.sortedLayerIds.splice(effectiveNewIndex, 0, layerId);
		this.reindexLayers();
		return true;
	}

	public updateLayer(
		layerId: string,
		updates: DeepPartial<ILayerModel>
	): {
		success: boolean;
		reindexed?: { id: string; index: number }[];
	} {
		const layer = this.layers.get(layerId);
		if (!layer) {
			return { success: false };
		}

		const currentOrderIndex = this.sortedLayerIds.indexOf(layerId);

		if (updates.index !== undefined && updates.index !== currentOrderIndex) {
			if (currentOrderIndex !== -1) {
				this.sortedLayerIds.splice(currentOrderIndex, 1);
			}
			const effectiveUpdateIndex = Math.max(0, Math.min(updates.index, this.sortedLayerIds.length));
			this.sortedLayerIds.splice(effectiveUpdateIndex, 0, layerId);
		}
		layer.update(updates);

		const reindexed = this.reindexLayers();
		return { success: true, reindexed };
	}

	public getLayerById(layerId: string): Layer | undefined {
		return this.layers.get(layerId);
	}

	public getSortedLayers(): Layer[] {
		return this.sortedLayerIds
			.map((id) => this.layers.get(id))
			.filter((layer) => layer !== undefined);
	}

	public getFirstLayer(): Layer | undefined {
		return this.layers.get(this.sortedLayerIds[0]);
	}

	public hasLayer(layerId: string): boolean {
		return this.layers.has(layerId);
	}

	public clear(): void {
		this.layers.forEach((layer) => this.emit('layer::removed', { id: layer.id }));
		this.layers.clear();
		this.sortedLayerIds = [];
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
