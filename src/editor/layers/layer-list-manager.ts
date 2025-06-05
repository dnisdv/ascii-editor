import type { DeepPartial, ILayer, ILayerModel } from '@editor/types';

export class LayersListManager {
	private layers: Map<string, ILayer>;
	private sortedLayerIds: string[];
	private activeLayerKey: string | null;

	constructor(layers: ILayer[] = []) {
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
				layer.updateIndex(index);
				reindexedLayers.push({ id, index });
			}
		});

		return reindexedLayers;
	}

	public addLayer(layer: ILayer): void {
		const layerId = layer.id;
		this.layers.set(layerId, layer);

		const existingIndex = this.sortedLayerIds.indexOf(layerId);
		if (existingIndex > -1) {
			this.sortedLayerIds.splice(existingIndex, 1);
		}

		this.sortedLayerIds.push(layerId);
		this.reindexLayers();
	}

	public insertLayerAtIndex(layer: ILayer, index: number): { id: string; index: number }[] {
		const layerId = layer.id;

		const oldIndex = this.sortedLayerIds.indexOf(layerId);
		if (oldIndex !== -1) {
			this.sortedLayerIds.splice(oldIndex, 1);
		}

		this.layers.set(layerId, layer);

		const effectiveIndex = Math.max(0, Math.min(index, this.sortedLayerIds.length));
		this.sortedLayerIds.splice(effectiveIndex, 0, layerId);
		return this.reindexLayers();
	}

	public addMultipleLayers(layersToAdd: ILayer[]): void {
		if (layersToAdd.length === 0) return;

		layersToAdd.forEach((layer) => {
			const layerId = layer.id;
			this.layers.set(layerId, layer);

			const existingIndex = this.sortedLayerIds.indexOf(layerId);
			if (existingIndex > -1) {
				this.sortedLayerIds.splice(existingIndex, 1);
			}
			this.sortedLayerIds.push(layerId);
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

		let newActiveKey = this.activeLayerKey;
		if (this.activeLayerKey === layerId) {
			newActiveKey = this.sortedLayerIds[index] || this.sortedLayerIds[index - 1] || null;
			this.activeLayerKey = newActiveKey;
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
		beforeAfter?: { before: ILayerModel; after: ILayerModel };
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

		const beforeAfter = layer.update(updates);
		const reindexed = this.reindexLayers();
		return { success: true, beforeAfter, reindexed };
	}

	public getLayerById(layerId: string): ILayer | undefined {
		return this.layers.get(layerId);
	}

	public getSortedLayers(): ILayer[] {
		return this.sortedLayerIds
			.map((id) => this.layers.get(id))
			.filter((layer) => layer !== undefined);
	}

	public getFirstLayer(): ILayer | undefined {
		return this.layers.get(this.sortedLayerIds[0]);
	}

	public hasLayer(layerId: string): boolean {
		return this.layers.has(layerId);
	}

	public clear(): void {
		this.layers.clear();
		this.sortedLayerIds = [];
		this.activeLayerKey = null;
	}

	public getActiveLayer(): ILayer | null {
		return this.activeLayerKey ? this.layers.get(this.activeLayerKey) || null : null;
	}

	public setActiveLayer(layerId: string | null): boolean {
		if (layerId === null || !layerId) {
			this.activeLayerKey = null;
			return true;
		}

		if (!this.layers.has(layerId)) {
			return false;
		}

		this.activeLayerKey = layerId;
		return true;
	}

	public getActiveLayerKey(): string | null {
		return this.activeLayerKey;
	}
}
