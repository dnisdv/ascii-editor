import type { CoreApi } from "../core.type";
import { LayerFactory } from "./layer-factory";
import { LayerCreateAndActivate, LayerRemove, LayersChangeActive, SetCharHandler } from "@editor/history/layers";
import type { HistoryManager } from "@editor/history-manager";
import { LayerUpdate } from "@editor/history/layers/layer-update";
import type { ITileMap, ILayer, LayerConfig, ILayersManager, LayersManagerIEvents, ILayerModel } from "@editor/types";
import { LayerSerializer } from "@editor/serializer/layer.serializer";
import { EventEmitter } from "@editor/event-emitter";
import { LayerRemoveAndActivate } from "@editor/history/layers/layer-remove-and-activate";
import { SetRegion } from "@editor/history/layers/layer-set-region";
import type { BusManager } from "@editor/bus-manager";
import { LayersListManager } from "./layer-list-manager";
import { TempLayersListManager } from "./templayer-list-manager";

export class LayersManager extends EventEmitter<LayersManagerIEvents> implements ILayersManager {
  private layers: LayersListManager;
  private tempLayers: TempLayersListManager;

  private layerFactory: LayerFactory;
  private historyManager: HistoryManager;
  private layerSerializer: LayerSerializer;

  private bus: BusManager

  constructor(public coreApi: CoreApi) {
    super()
    this.bus = coreApi.getBusManager()

    this.layers = new LayersListManager();
    this.tempLayers = new TempLayersListManager();

    this.layerFactory = new LayerFactory(this.coreApi);
    this.layerSerializer = new LayerSerializer(this.coreApi);

    this.historyManager = this.coreApi.getHistoryManager();
    this.historyManager.registerTarget('layers', this);

    this.registerHistoryHandlers();
    this.registerStoreEventListeners();
  }

  private registerHistoryHandlers() {
    this.historyManager.registerHandler('layer::set_chars', new SetCharHandler());
    this.historyManager.registerHandler('layer::update', new LayerUpdate());
    this.historyManager.registerHandler('layers::change::active', new LayersChangeActive());
    this.historyManager.registerHandler('layers::create_and_activate', new LayerCreateAndActivate());
    this.historyManager.registerHandler('layers::remove', new LayerRemove());
    this.historyManager.registerHandler('layers::remove_and_activate', new LayerRemoveAndActivate());
    this.historyManager.registerHandler('layer::set_region', new SetRegion());
  }

  private registerStoreEventListeners() {
    this.bus.layers.on('layer::create::request', () => this.handleLayerRequestCreate());
    this.bus.layers.on('layer::remove::request', ({ id }) => this.handleLayerRemoveRequest(id));
    this.bus.layers.on('layer::update::request', ({ id, ...rest }) => this.handleLayerUpdateRequest(id, rest));
    this.bus.layers.on('layer::change_active::request', ({ id }) => this.handleActivateLayerRequest(id));
  }

  private handleLayerRequestCreate(): void {
    const [id, layer] = this.addLayerSilent()

    this.historyManager.applyAction(
      {
        type: 'layers::create_and_activate',
        targetId: `layers`,
        before: { layer: null, activeKey: this.getActiveLayerKey() },
        after: { layer: this.layerSerializer.serialize(layer), activeKey: id },
      },
      { applyAction: false }
    );
  }

  private handleLayerRemoveRequest(id: string) {
    const layer = this.getLayer(id);
    this.unregisterLayerEvents(layer)
    this.removeLayer(id)
  }

  private handleLayerUpdateRequest(id: string, updates: Partial<ILayer>) {
    const beforeLayer = this.getLayer(id);
    if (!beforeLayer) return;

    const beforeData = this.layerSerializer.serialize(beforeLayer);

    const res = this.layers.updateLayer(id, updates);
    if (res.success && res.beforeAfter) {
      this.bus.layers.emit('layer::update::response', res.beforeAfter.after);
    }

    if (res.reindexed) {
      this.bus.layers.emit('layers::update::response', res.reindexed, { reason: 'reindexed' });
    }

    this.historyManager.applyAction(
      {
        type: 'layer::update',
        targetId: `layers`,
        before: beforeData,
        after: this.layerSerializer.serialize(this.getLayer(id)!),
      },
      { applyAction: false }
    );

    this.emit('layer::updated', {
      before: beforeData,
      after: this.layerSerializer.serialize(this.getLayer(id)!)
    });
    this.coreApi.render();
  }

  private handleActivateLayerRequest(id: string) {
    this.setActiveLayer(id)
  }

  private registerToLayerEvents(layer: ILayer) {
    layer.on('tile_change', (tile) => this.bus.layers.emit('layer::tile::change', tile), this);
    layer.on('tile_deleted', ({ x, y, layerId }) => this.bus.layers.emit('layer::tile::removed', { x, y, layerId }))

    this.historyManager.registerTarget(`layer::${layer.id}`, layer)
  }

  private unregisterLayerEvents(layer: ILayer | null) {
    if (!layer) return;
    layer.off('tile_change');
    layer.off('tile_deleted')
  }

  private setActiveLayerInternal(id: string): boolean {
    if (String(id) === String(this.getActiveLayerKey())) return false;
    const success = this.layers.setActiveLayer(id);
    return success;
  }

  private addLayerInternal(): [string, ILayer] {
    const [id, layer] = this.layerFactory.createLayerWithDefaultConfig();
    this.layers.addLayer(layer);
    this.registerToLayerEvents(layer)
    return [id, layer]
  }

  private removeLayerInternal(id: string): { removed: boolean, newActive: string | null | undefined } {
    const layer = this.getLayer(id);
    if (!layer) return { removed: false, newActive: null };
    this.emit('layer::pre-remove', { layer });

    const { removed, newActive } = this.layers.removeLayer(id)

    this.coreApi.render();
    return { removed, newActive }
  };

  private updateLayerInternal(id: string, updates: Partial<ILayerModel>): ReturnType<LayersListManager['updateLayer']> {
    return this.layers.updateLayer(id, updates)
  }

  updateLayer(id: string, updates: Partial<ILayerModel>) {
    const beforeLayer = this.getLayer(id);
    if (!beforeLayer) return;
    const beforeData = this.layerSerializer.serialize(beforeLayer);

    const res = this.updateLayerInternal(id, updates);

    if (res.success && res.beforeAfter) {
      this.bus.layers.emit('layer::update::response', res.beforeAfter.after);
    }

    if (res.reindexed) {
      this.bus.layers.emit('layers::update::response', res.reindexed, { reason: 'reindexed' });
    }

    this.historyManager.applyAction(
      {
        type: 'layer::update',
        targetId: `layers`,
        before: beforeData,
        after: this.layerSerializer.serialize(this.getLayer(id)!),
      },
      { applyAction: false }
    );

    this.emit('layer::updated', {
      before: beforeData,
      after: this.layerSerializer.serialize(this.getLayer(id)!)
    });

    this.coreApi.render();
  }

  updateLayerSilent(id: string, updates: Partial<ILayerModel>) {
    const beforeLayer = this.getLayer(id);
    if (!beforeLayer) return;

    const beforeData = this.layerSerializer.serialize(beforeLayer);
    const res = this.updateLayerInternal(id, updates);

    if (res.success && res.beforeAfter) {
      this.bus.layers.emit('layer::update::response', res.beforeAfter.after);
    }

    if (res.reindexed) {
      this.bus.layers.emit('layers::update::response', res.reindexed, { reason: 'reindexed' });
    }

    this.emit('layer::updated', {
      before: beforeData,
      after: this.layerSerializer.serialize(this.getLayer(id)!)
    });

    this.coreApi.render();
  }

  addLayer(): [string, ILayer] {
    const [id, layer] = this.addLayerInternal()
    this.bus.layers.emit('layer::create::response', { id, name: layer.name, index: layer.index, opts: layer.opts });

    this.setActiveLayer(id);
    return [id, layer];
  }

  addLayerSilent(): [string, ILayer] {
    const [id, layer] = this.addLayerInternal()
    this.bus.layers.emit('layer::create::response', { id, name: layer.name, index: layer.index, opts: layer.opts });
    this.silentActivateLayer(id);
    return [id, layer];
  }

  removeLayerSilent(id: string): void {
    const { newActive } = this.removeLayerInternal(id)
    this.bus.layers.emit('layer::remove::response', { id });
    if (newActive) {
      this.bus.layers.emit('layer::change_active::response', { id: newActive }, { reason: 'auto_switch' });
    }
  }

  removeLayer(id: string): void {
    const activeKey = this.getActiveLayerKey();
    const layer = this.getLayer(id);
    if (!layer) return;

    const { removed, newActive } = this.removeLayerInternal(id)

    if (removed) {
      this.bus.layers.emit('layer::remove::response', { id });
      if (newActive) {
        this.bus.layers.emit('layer::change_active::response', { id: newActive }, { reason: 'auto_switch' });
        this.historyManager.applyAction(
          {
            type: 'layers::remove_and_activate',
            targetId: `layers`,
            before: { layer: this.layerSerializer.serialize(layer), activeKey },
            after: { layer: null, activeKey: newActive },
          },
          { applyAction: false }
        );
      } else {
        this.historyManager.applyAction(
          {
            type: 'layers::remove',
            targetId: `layers`,
            before: { layer: this.layerSerializer.serialize(layer) },
            after: { layer: null },
          },
          { applyAction: false }
        );
      }
    }
  }

  removeTempLayer(id: string): void {
    const layer = this.getTempLayer(id);
    if (!layer) return;
    this.tempLayers.removeLayer(id);
  }

  setActiveLayer(id: string): void {
    const oldId = this.getActiveLayerKey() || null
    const success = this.setActiveLayerInternal(id);

    if (success) {
      this.bus.layers.emit('layer::change_active::response', { id }, { reason: 'user_action' });
      this.emit('layers::active::change', { oldId, newId: id });

      this.historyManager.applyAction(
        {
          type: 'layers::change::active',
          targetId: `layers`,
          before: { id: oldId },
          after: { id: id },
        },
        { applyAction: false }
      );
      this.coreApi.render();
    }
  }

  silentActivateLayer(id: string): void {
    const oldId = this.getActiveLayerKey() || null
    const success = this.setActiveLayerInternal(id);
    if (success) {
      this.bus.layers.emit('layer::change_active::response', { id }, { reason: 'user_action' });
      this.emit('layers::active::change', { oldId, newId: id });
    }
  }

  insertLayer(id: string, layer: ILayer) {
    this.layers.addLayer(layer);
    this.registerToLayerEvents(layer)
    this.bus.layers.emit('layer::create::response', { id, name: layer.name, index: layer.index, opts: layer.opts });
  }

  insertLayerAtIndex(index: number, layer: ILayer): void {
    const reindexed = this.layers.insertLayerAtIndex(layer, index);

    this.bus.layers.emit('layer::create::response', { id: layer.id, name: layer.name, index: layer.index, opts: layer.opts });
    if (reindexed && reindexed.length > 0) {
      this.bus.layers.emit('layers::update::response', reindexed, { reason: 'reindexed' });
    }
    this.bus.layers.emit('layer::change_active::response', { id: layer.id }, { reason: 'user_action' });

    const tiles = layer.queryAllTiles()
    for (const tile of tiles) {
      this.bus.layers.emit('layer::tile::change', { ...tile, layerId: layer.id })
    }

    this.registerToLayerEvents(layer)
    this.coreApi.render();
  }


  addTempLayer(index?: number): [string, ILayer] {
    const newIndex = index ?? this.getActiveLayer()?.index ?? 0;

    const [id, layer] = this.layerFactory.createTempLayer();
    layer.updateIndex(newIndex)
    this.tempLayers.insertLayerAtIndex(layer, newIndex);

    return [id, layer];
  }

  createLayer({ id, name, index, opts, tileMap }: { id: string; index: number; name: string; opts: LayerConfig; tileMap: ITileMap }): ILayer {
    return this.layerFactory.newLayer({ id, name, index, opts, tileMap });
  }

  getLayer(key: string) {
    return this.layers.getLayerById(key) || null;
  }

  getTempLayer(key: string) {
    return this.tempLayers.getLayerById(key) || null;
  }

  getTempOrRealLayer(key: string) {
    return this.layers.getLayerById(key) || this.tempLayers.getLayerById(key) || null;
  }

  getLayers() {
    return [...this.layers.getSortedLayers()];
  }

  getTempLayers() {
    return [...this.tempLayers.getSortedLayers()];
  }

  ensureLayer(): ILayer {
    let activeLayer = this.getLayer(this.getActiveLayerKey() || '');
    if (!activeLayer) {
      const [id, layer] = this.addLayerSilent()

      this.historyManager.applyAction(
        {
          type: 'layers::create_and_activate',
          targetId: `layers`,
          before: { layer: null, activeKey: this.getActiveLayerKey() },
          after: { layer: this.layerSerializer.serialize(layer), activeKey: id },
        },
        { applyAction: false }
      );
      activeLayer = layer;
    }

    return activeLayer;
  }

  getActiveLayer(): ILayer | null {
    return this.getLayer(this.getActiveLayerKey() || '');
  }

  getActiveLayerKey(): string | null {
    return this.layers.getActiveLayerKey();
  }

  clearLayers(): void {
    this.layers.clear();
  }

  clearTempLayers(): void {
    this.tempLayers.clear();
  }

  getAllVisibleLayers() {
    const allLayers = [...this.layers.getSortedLayers(), ...this.tempLayers.getSortedLayers()];
    return allLayers.filter((layer) => layer.getOpts().visible);
  }

  getCombinedTileData(tileX: number, tileY: number): string {
    const tileSize = this.coreApi.getConfig().tileSize;
    const buffer = new Array(tileSize * tileSize).fill(" ");

    const visibleLayers = this.getAllVisibleLayersSorted();

    for (const layer of visibleLayers) {
      const tile = layer.tileMap.getTile(tileX, tileY);
      if (!tile) continue;

      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] !== " ") continue;
        const row = Math.floor(i / tileSize);
        const col = i % tileSize;
        const candidate = tile.getChar(col, row);
        if (candidate && candidate.trim() !== "") {
          buffer[i] = candidate;
        }
      }
    }

    let result = "";
    for (let row = 0; row < tileSize; row++) {
      const startIndex = row * tileSize;
      const rowChars = buffer.slice(startIndex, startIndex + tileSize).join("");
      result += row < tileSize - 1 ? rowChars + "\n" : rowChars;
    }
    return result;
  }

  getAllVisibleLayersSorted() {
    const realLayers = this.layers.getSortedLayers();
    const tempLayers = this.tempLayers.getSortedLayers();

    const visibleReal = realLayers.filter((layer: ILayer) => layer.getOpts().visible);
    const visibleTemp = tempLayers.filter((layer: ILayer) => layer.getOpts().visible);

    const combined = [...visibleReal, ...visibleTemp];

    combined.sort((a, b) => {
      const indexDiff = a.index - b.index;
      if (indexDiff !== 0) {
        return indexDiff;
      }

      const aIsTemp = !!this.tempLayers.getLayerById(a.id);
      const bIsTemp = !!this.tempLayers.getLayerById(b.id);

      if (aIsTemp && !bIsTemp) return -1;
      if (!aIsTemp && bIsTemp) return 1;

      return 0;
    });

    return combined;
  }

  getVisibleLayers() {
    const allLayers = [...this.layers.getSortedLayers()];
    return allLayers.filter((layer) => layer.getOpts().visible);
  }

  getVisibleTempLayers() {
    const allLayers = [...this.tempLayers.getSortedLayers()];
    return allLayers.filter((layer) => layer.getOpts().visible);
  }
}

