import type { ILayer, ILayerModel } from '@editor/types';

export class TempLayersListManager {
	private layers: Map<string, ILayer>;
	private sortedLayerIds: string[];

	constructor(layers: ILayer[] = []) {
		this.layers = new Map(layers.map((layer) => [layer.id, layer]));
		this.sortedLayerIds = layers.map((layer) => layer.id);
	}

	addLayer(layer: ILayer): void {
		const layerId = layer.id;
		this.layers.set(layerId, layer);

		const existingIndex = this.sortedLayerIds.indexOf(layerId);
		if (existingIndex > -1) {
			this.sortedLayerIds.splice(existingIndex, 1);
		}

		this.sortedLayerIds.push(layerId);
	}

	public insertLayerAtIndex(layer: ILayer, index: number): void {
		const layerId = layer.id;

		const oldIndex = this.sortedLayerIds.indexOf(layerId);
		if (oldIndex !== -1) {
			this.sortedLayerIds.splice(oldIndex, 1);
		}

		this.layers.set(layerId, layer);

		const effectiveIndex = Math.max(0, Math.min(index, this.sortedLayerIds.length));
		this.sortedLayerIds.splice(effectiveIndex, 0, layerId);
	}

	addMultipleLayers(layersToAdd: ILayer[]): void {
		if (layersToAdd.length === 0) {
			return;
		}

		layersToAdd.forEach((layer) => {
			const layerId = layer.id;
			this.layers.set(layerId, layer);

			const existingIndex = this.sortedLayerIds.indexOf(layerId);
			if (existingIndex > -1) this.sortedLayerIds.splice(existingIndex, 1);
			this.sortedLayerIds.push(layerId);
		});
	}

	removeLayer(layerId: string): { removed: boolean; newActive?: string | null } {
		const index = this.sortedLayerIds.indexOf(layerId);
		if (index === -1) {
			if (this.layers.has(layerId)) this.layers.delete(layerId);
			return { removed: false };
		}

		this.layers.delete(layerId);
		this.sortedLayerIds.splice(index, 1);

		return { removed: true };
	}

	moveLayerToPosition(layerId: string, newIndex: number): boolean {
		const currentIndex = this.sortedLayerIds.indexOf(layerId);

		if (currentIndex === -1) return false;

		this.sortedLayerIds.splice(currentIndex, 1);
		const effectiveNewIndex = Math.max(0, Math.min(newIndex, this.sortedLayerIds.length));
		this.sortedLayerIds.splice(effectiveNewIndex, 0, layerId);
		return true;
	}

	updateLayer(
		layerId: string,
		updates: Partial<ILayerModel>
	): {
		success: boolean;
		beforeAfter?: { before: ILayerModel; after: ILayerModel };
		reindexed?: { id: string; index: number }[];
	} {
		const layer = this.layers.get(layerId);
		if (!layer) return { success: false };

		const currentIndex = this.sortedLayerIds.indexOf(layerId);

		if (updates.index !== undefined && updates.index !== currentIndex) {
			if (currentIndex !== -1) this.sortedLayerIds.splice(currentIndex, 1);
			const effectiveUpdateIndex = Math.max(0, Math.min(updates.index, this.sortedLayerIds.length));
			this.sortedLayerIds.splice(effectiveUpdateIndex, 0, layerId);
		}
		return { success: true };
	}

	getLayerById(layerId: string): ILayer | undefined {
		return this.layers.get(layerId);
	}

	getSortedLayers(): ILayer[] {
		return this.sortedLayerIds.map((id) => this.layers.get(id)!);
	}

	getFirstLayer(): ILayer | undefined {
		return this.layers.get(this.sortedLayerIds[0]);
	}

	hasLayer(layerId: string): boolean {
		return this.layers.has(layerId);
	}

	clear(): void {
		this.layers.clear();
		this.sortedLayerIds = [];
	}
}
