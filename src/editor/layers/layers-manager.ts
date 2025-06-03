import type { HistoryManager } from '@editor/history-manager';
import type {
	ITileMap,
	ILayer,
	LayerConfig,
	ILayersManager,
	LayersManagerIEvents,
	ILayerModel,
	LayerSerializableSchemaType,
	DeepPartial
} from '@editor/types';
import type { BaseBusLayers } from '@editor/bus-layers';
import type { Config } from '@editor/config';

import { LayerFactory } from './layer-factory';
import { LayerSerializer } from '@editor/serializer/layer.serializer';
import { EventEmitter } from '@editor/event-emitter';
import { LayersListManager } from './layer-list-manager';
import { TempLayersListManager } from './templayer-list-manager';
import { LayerCreateAndActivate, LayerRemove, LayersChangeActive, SetCharHandler } from './history';
import { LayerUpdate } from './history/layer-update';
import { LayerRemoveAndActivate } from './history/layer-remove-and-activate';
import { SetRegion } from './history/layer-set-region';

export interface LayersManagerOption {
	layersBus: BaseBusLayers;
	config: Config;
	historyManager: HistoryManager;
}

// TODO: MOVE LOGIC NOT RELATED TO LAYERS TO SOMEWHER ELSE
export class LayersManager extends EventEmitter<LayersManagerIEvents> implements ILayersManager {
	private layers: LayersListManager;
	private tempLayers: TempLayersListManager;

	private layerFactory: LayerFactory;
	private historyManager: HistoryManager;
	private layerSerializer: LayerSerializer;
	private config: Config;

	private bus: BaseBusLayers;

	constructor({ layersBus, config, historyManager }: LayersManagerOption) {
		super();
		this.bus = layersBus;
		this.config = config;

		this.layers = new LayersListManager();
		this.tempLayers = new TempLayersListManager();

		this.layerFactory = new LayerFactory({ layersBus: this.bus, config: this.config });
		this.layerSerializer = new LayerSerializer({ layersBus: this.bus });

		this.historyManager = historyManager;
		this.historyManager.registerTarget('layers', this);

		this.registerHistoryHandlers();
		this.registerStoreEventListeners();
	}

	private registerHistoryHandlers() {
		this.historyManager.registerHandler('layer::set_chars', new SetCharHandler());
		this.historyManager.registerHandler('layer::update', new LayerUpdate());
		this.historyManager.registerHandler('layers::change::active', new LayersChangeActive());
		this.historyManager.registerHandler(
			'layers::create_and_activate',
			new LayerCreateAndActivate()
		);
		this.historyManager.registerHandler('layers::remove', new LayerRemove());
		this.historyManager.registerHandler(
			'layers::remove_and_activate',
			new LayerRemoveAndActivate()
		);
		this.historyManager.registerHandler('layer::set_region', new SetRegion());
	}

	private registerStoreEventListeners() {
		this.bus.on('layer::create::request', () => this.handleLayerRequestCreate());
		this.bus.on('layer::remove::request', ({ id }) => this.handleLayerRemoveRequest(id));
		this.bus.on('layer::update::request', ({ id, ...rest }) =>
			this.handleLayerUpdateRequest(id, rest)
		);
		this.bus.on('layer::change_active::request', ({ id }) => this.handleActivateLayerRequest(id));
	}

	private handleLayerRequestCreate(): void {
		const [id, layer] = this.addLayerSilent();

		this.historyManager.applyAction(
			{
				type: 'layers::create_and_activate',
				targetId: `layers`,
				before: { layer: null, activeKey: this.getActiveLayerKey() },
				after: { layer: this.layerSerializer.serialize(layer), activeKey: id }
			},
			{ applyAction: false }
		);
	}

	private handleLayerRemoveRequest(id: string) {
		const layer = this.getLayer(id);
		this.unregisterLayerEvents(layer);
		this.removeLayer(id);
	}

	private handleLayerUpdateRequest(id: string, updates: DeepPartial<ILayerModel>) {
		const beforeLayer = this.getLayer(id);
		if (!beforeLayer) return;

		const beforeData = this.layerSerializer.serialize(beforeLayer);

		const res = this.layers.updateLayer(id, updates);
		if (res.success && res.beforeAfter) {
			this.bus.emit('layer::update::response', res.beforeAfter.after);
		}

		if (res.reindexed) {
			this.bus.emit('layers::update::response', res.reindexed);
		}

		this.historyManager.applyAction(
			{
				type: 'layer::update',
				targetId: `layers`,
				before: beforeData,
				after: this.layerSerializer.serialize(this.getLayer(id)!)
			},
			{ applyAction: false }
		);

		this.emit('layer::updated', {
			before: beforeData,
			after: this.layerSerializer.serialize(this.getLayer(id)!)
		});
	}

	private handleActivateLayerRequest(id: string) {
		this.setActiveLayer(id);
	}

	private registerToLayerEvents(layer: ILayer) {
		layer.on('tile_change', (tile) => this.bus.emit('layer::tile::change', tile), this);
		layer.on('tile_deleted', ({ x, y, layerId }) =>
			this.bus.emit('layer::tile::removed', { x, y, layerId })
		);

		this.historyManager.registerTarget(`layer::${layer.id}`, layer);
	}

	private unregisterLayerEvents(layer: ILayer | null) {
		if (!layer) return;
		layer.off('tile_change');
		layer.off('tile_deleted');
	}

	private setActiveLayerInternal(id: string): boolean {
		if (String(id) === String(this.getActiveLayerKey())) return false;
		const success = this.layers.setActiveLayer(id);
		return success;
	}

	private addLayerInternal(): [string, ILayer] {
		const [id, layer] = this.layerFactory.createLayerWithDefaultConfig();
		this.layers.addLayer(layer);
		this.registerToLayerEvents(layer);
		return [id, layer];
	}

	private removeLayerInternal(id: string): {
		removed: boolean;
		newActive: string | null | undefined;
	} {
		const layer = this.getLayer(id);
		if (!layer) return { removed: false, newActive: null };
		this.emit('layer::pre-remove', { layer });

		const { removed, newActive } = this.layers.removeLayer(id);
		return { removed, newActive };
	}

	private updateLayerInternal(
		id: string,
		updates: DeepPartial<ILayerModel>
	): ReturnType<LayersListManager['updateLayer']> {
		return this.layers.updateLayer(id, updates);
	}

	public getBus(): BaseBusLayers {
		return this.bus;
	}

	public updateLayer(id: string, updates: DeepPartial<ILayerModel>) {
		const beforeLayer = this.getLayer(id);
		if (!beforeLayer) return;
		const beforeData = this.layerSerializer.serialize(beforeLayer);

		const res = this.updateLayerInternal(id, updates);

		if (res.success && res.beforeAfter) {
			this.bus.emit('layer::update::response', res.beforeAfter.after);
		}

		if (res.reindexed) {
			this.bus.emit('layers::update::response', res.reindexed);
		}

		this.historyManager.applyAction(
			{
				type: 'layer::update',
				targetId: `layers`,
				before: beforeData,
				after: this.layerSerializer.serialize(this.getLayer(id)!)
			},
			{ applyAction: false }
		);

		this.emit('layer::updated', {
			before: beforeData,
			after: this.layerSerializer.serialize(this.getLayer(id)!)
		});
	}

	public updateLayerSilent(id: string, updates: DeepPartial<ILayerModel>) {
		const beforeLayer = this.getLayer(id);
		if (!beforeLayer) return;

		const beforeData = this.layerSerializer.serialize(beforeLayer);
		const res = this.updateLayerInternal(id, updates);

		if (res.success && res.beforeAfter) {
			this.bus.emit('layer::update::response', res.beforeAfter.after);
		}

		if (res.reindexed) {
			this.bus.emit('layers::update::response', res.reindexed);
		}

		this.emit('layer::updated', {
			before: beforeData,
			after: this.layerSerializer.serialize(this.getLayer(id)!)
		});
	}

	public addLayer(): [string, ILayer] {
		const [id, layer] = this.addLayerInternal();
		this.bus.emit('layer::create::response', {
			id,
			name: layer.name,
			index: layer.index,
			opts: layer.opts
		});

		this.setActiveLayer(id);
		return [id, layer];
	}

	public addLayerSilent(): [string, ILayer] {
		const [id, layer] = this.addLayerInternal();
		this.bus.emit('layer::create::response', {
			id,
			name: layer.name,
			index: layer.index,
			opts: layer.opts
		});
		this.silentActivateLayer(id);

		return [id, layer];
	}

	public removeLayerSilent(id: string): void {
		const { newActive } = this.removeLayerInternal(id);
		this.bus.emit('layer::remove::response', { id });
		if (newActive) {
			this.bus.emit('layer::change_active::response', { id: newActive });
		}
	}

	public removeLayer(id: string): void {
		const activeKey = this.getActiveLayerKey();
		const layer = this.getLayer(id);
		if (!layer) return;

		const { removed, newActive } = this.removeLayerInternal(id);

		if (removed) {
			this.bus.emit('layer::remove::response', { id });

			this.bus.emit('layer::change_active::response', { id: newActive || null });
			this.historyManager.applyAction(
				{
					type: 'layers::remove_and_activate',
					targetId: `layers`,
					before: { layer: this.layerSerializer.serialize(layer), activeKey },
					after: { layer: null, activeKey: newActive || null }
				},
				{ applyAction: false }
			);
			this.emit('layer::removed');
		}
	}

	public removeTempLayer(id: string): void {
		const layer = this.getTempLayer(id);
		if (!layer) return;
		this.tempLayers.removeLayer(id);
	}

	public setActiveLayer(id: string): void {
		const oldId = this.getActiveLayerKey() || null;
		const success = this.setActiveLayerInternal(id);

		if (success) {
			this.bus.emit('layer::change_active::response', { id });
			this.emit('layers::active::change', { oldId, newId: id });

			this.historyManager.applyAction(
				{
					type: 'layers::change::active',
					targetId: `layers`,
					before: { id: oldId },
					after: { id: id }
				},
				{ applyAction: false }
			);
		}
	}

	public silentActivateLayer(id: string): void {
		const oldId = this.getActiveLayerKey() || null;
		const success = this.setActiveLayerInternal(id);
		if (success) {
			this.bus.emit('layer::change_active::response', { id });
			this.emit('layers::active::change', { oldId, newId: id });
		}
	}

	public insertLayer(id: string, layer: ILayer) {
		this.layers.addLayer(layer);
		this.registerToLayerEvents(layer);
		this.bus.emit('layer::create::response', {
			id,
			name: layer.name,
			index: layer.index,
			opts: layer.opts
		});
	}

	public insertLayerAtIndex(index: number, layer: ILayer): void {
		const reindexed = this.layers.insertLayerAtIndex(layer, index);

		this.bus.emit('layer::create::response', {
			id: layer.id,
			name: layer.name,
			index: layer.index,
			opts: layer.opts
		});
		if (reindexed && reindexed.length > 0) {
			this.bus.emit('layers::update::response', reindexed);
		}
		this.bus.emit('layer::change_active::response', { id: layer.id });

		const tiles = layer.queryAllTiles();
		for (const tile of tiles) {
			this.bus.emit('layer::tile::change', { ...tile, layerId: layer.id });
		}

		this.registerToLayerEvents(layer);
	}

	public addTempLayer(index?: number): [string, ILayer] {
		const newIndex = index ?? this.getActiveLayer()?.index ?? 0;

		const [id, layer] = this.layerFactory.createTempLayer();
		layer.updateIndex(newIndex);
		this.tempLayers.insertLayerAtIndex(layer, newIndex);

		return [id, layer];
	}

	public createLayer({
		id,
		name,
		index,
		opts,
		tileMap
	}: {
		id: string;
		index: number;
		name: string;
		opts: LayerConfig;
		tileMap: ITileMap;
	}): ILayer {
		return this.layerFactory.newLayer({ id, name, index, opts, tileMap });
	}

	public getLayer(key: string) {
		return this.layers.getLayerById(key) || null;
	}

	public getTempLayer(key: string) {
		return this.tempLayers.getLayerById(key) || null;
	}

	public getTempOrRealLayer(key: string) {
		return this.layers.getLayerById(key) || this.tempLayers.getLayerById(key) || null;
	}

	public getLayers() {
		return [...this.layers.getSortedLayers()];
	}

	public getTempLayers() {
		return [...this.tempLayers.getSortedLayers()];
	}

	public ensureLayer(): ILayer {
		let activeLayer = this.getLayer(this.getActiveLayerKey() || '');
		if (!activeLayer) {
			const [id, layer] = this.addLayerSilent();

			this.historyManager.applyAction(
				{
					type: 'layers::create_and_activate',
					targetId: `layers`,
					before: { layer: null, activeKey: this.getActiveLayerKey() },
					after: { layer: this.layerSerializer.serialize(layer), activeKey: id }
				},
				{ applyAction: false }
			);
			activeLayer = layer;
		}

		return activeLayer;
	}

	public getActiveLayer(): ILayer | null {
		return this.getLayer(this.getActiveLayerKey() || '');
	}

	public getActiveLayerKey(): string | null {
		return this.layers.getActiveLayerKey();
	}

	public clearLayers(): void {
		this.layers.clear();
	}

	public clearTempLayers(): void {
		this.tempLayers.clear();
	}

	public getAllVisibleLayers() {
		const allLayers = [...this.layers.getSortedLayers(), ...this.tempLayers.getSortedLayers()];
		return allLayers.filter((layer) => layer.getOpts().visible);
	}

	public getCombinedTileData(tileX: number, tileY: number): string {
		const tileSize = this.config.tileSize;
		const buffer = new Array(tileSize * tileSize).fill(' ');

		const visibleLayers = this.getAllVisibleLayersSorted();

		for (const layer of visibleLayers) {
			const tile = layer.tileMap.getTile(tileX, tileY);
			if (!tile) continue;

			for (let i = 0; i < buffer.length; i++) {
				if (buffer[i] !== ' ') continue;
				const row = Math.floor(i / tileSize);
				const col = i % tileSize;
				const candidate = tile.getChar(col, row);
				if (candidate && candidate.trim() !== '') {
					buffer[i] = candidate;
				}
			}
		}

		let result = '';
		for (let row = 0; row < tileSize; row++) {
			const startIndex = row * tileSize;
			const rowChars = buffer.slice(startIndex, startIndex + tileSize).join('');
			result += row < tileSize - 1 ? rowChars + '\n' : rowChars;
		}
		return result;
	}

	public getAllVisibleLayersSorted() {
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

	public getVisibleLayers() {
		const allLayers = [...this.layers.getSortedLayers()];
		return allLayers.filter((layer) => layer.getOpts().visible);
	}

	public getVisibleTempLayers() {
		const allLayers = [...this.tempLayers.getSortedLayers()];
		return allLayers.filter((layer) => layer.getOpts().visible);
	}

	public deserializeLayer(layer: LayerSerializableSchemaType) {
		return this.layerSerializer.deserialize(layer);
	}
}
