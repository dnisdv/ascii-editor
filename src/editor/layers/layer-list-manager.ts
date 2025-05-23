import type { ILayer, ILayerModel } from "@editor/types";

export class LayersListManager {
  private layers: Map<string, ILayer>;
  private sortedLayerIds: string[];
  private activeLayerKey: string | null;

  constructor(layers: ILayer[] = []) {
    this.layers = new Map(layers.map((layer) => [layer.id, layer]));
    this.sortedLayerIds = layers.map((layer) => layer.id);
    this.activeLayerKey = this.sortedLayerIds[0] || null;
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

    return reindexedLayers
  }

  addLayer(layer: ILayer): void {
    this.layers.set(layer.id, layer);
    this.sortedLayerIds.push(layer.id);
    this.reindexLayers();
  }

  public insertLayerAtIndex(layer: ILayer, index: number): { id: string; index: number }[] {
    if (this.layers.has(layer.id)) {
      const oldIndex = this.sortedLayerIds.indexOf(layer.id);
      if (oldIndex !== -1) {
        this.sortedLayerIds.splice(oldIndex, 1);
      }
    }

    this.layers.set(layer.id, layer);
    this.sortedLayerIds.splice(index, 0, layer.id);

    return this.reindexLayers();
  }

  addMultipleLayers(layers: ILayer[]): void {
    layers.forEach((layer) => {
      this.layers.set(layer.id, layer);
      this.sortedLayerIds.push(layer.id);
    });

    if (!this.activeLayerKey && layers.length > 0) {
      this.activeLayerKey = layers[0].id;
    }

    this.reindexLayers();
  }

  removeLayer(layerId: string): { removed: boolean; newActive?: string | null } {
    const index = this.sortedLayerIds.indexOf(layerId);
    if (index === -1) {
      return { removed: false };
    }

    this.layers.delete(layerId);
    this.sortedLayerIds.splice(index, 1);
    this.reindexLayers();

    let newActiveKey = this.activeLayerKey;
    if (this.activeLayerKey === layerId) {
      newActiveKey = this.sortedLayerIds[index] || this.sortedLayerIds[index - 1] || null;
      this.activeLayerKey = newActiveKey;
    }

    return { removed: true, newActive: newActiveKey };
  }

  moveLayerToPosition(layerId: string, newIndex: number): boolean {
    const currentIndex = this.sortedLayerIds.indexOf(layerId);

    if (currentIndex === -1) {
      return false;
    }

    this.sortedLayerIds.splice(currentIndex, 1);
    this.sortedLayerIds.splice(newIndex, 0, layerId);
    this.reindexLayers();
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

    const beforeAfter = layer.update(updates);
    const reindexed = this.reindexLayers();
    return { success: true, beforeAfter, reindexed };
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
    this.activeLayerKey = null;
  }

  getActiveLayer(): ILayer | null {
    return this.activeLayerKey ? this.layers.get(this.activeLayerKey) || null : null;
  }

  setActiveLayer(layerId: string): boolean {
    if (!this.layers.has(layerId)) {
      return false;
    }

    this.activeLayerKey = layerId;
    return true;
  }

  getActiveLayerKey(): string | null {
    return this.activeLayerKey;
  }
}

