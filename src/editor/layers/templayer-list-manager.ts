import type { ILayer, ILayerModel } from "@editor/types";

export class TempLayersListManager {
  private layers: Map<string, ILayer>;
  private sortedLayerIds: string[];

  constructor(layers: ILayer[] = []) {
    this.layers = new Map(layers.map((layer) => [layer.id, layer]));
    this.sortedLayerIds = layers.map((layer) => layer.id);
  }

  addLayer(layer: ILayer): void {
    this.layers.set(layer.id, layer);
    this.sortedLayerIds.push(layer.id);
  }

  public insertLayerAtIndex(layer: ILayer, index: number): void {
    if (this.layers.has(layer.id)) {
      const oldIndex = this.sortedLayerIds.indexOf(layer.id);
      if (oldIndex !== -1) {
        this.sortedLayerIds.splice(oldIndex, 1);
      }
    }

    this.layers.set(layer.id, layer);
    this.sortedLayerIds.splice(index, 0, layer.id);
  }

  addMultipleLayers(layers: ILayer[]): void {
    layers.forEach((layer) => {
      this.layers.set(layer.id, layer);
      this.sortedLayerIds.push(layer.id);
    });
  }

  removeLayer(layerId: string): { removed: boolean; newActive?: string | null } {
    const index = this.sortedLayerIds.indexOf(layerId);
    if (index === -1) {
      return { removed: false };
    }

    this.layers.delete(layerId);
    this.sortedLayerIds.splice(index, 1);

    return { removed: true };
  }

  moveLayerToPosition(layerId: string, newIndex: number): boolean {
    const currentIndex = this.sortedLayerIds.indexOf(layerId);

    if (currentIndex === -1) {
      return false;
    }

    this.sortedLayerIds.splice(currentIndex, 1);
    this.sortedLayerIds.splice(newIndex, 0, layerId);
    return true;
  }

  updateLayer(layerId: string, updates: Partial<ILayerModel>): { success: boolean; beforeAfter?: { before: ILayerModel; after: ILayerModel }; reindexed?: { id: string; index: number }[] } {
    const layer = this.layers.get(layerId);
    if (!layer) {
      return { success: false };
    }

    const currentIndex = this.sortedLayerIds.indexOf(layerId);

    if (updates.index !== undefined && updates.index !== layer.index) {
      this.sortedLayerIds.splice(currentIndex, 1);
      this.sortedLayerIds.splice(updates.index, 0, layerId);
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

