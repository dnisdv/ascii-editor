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
import { CreateAndActivateLayerCommand } from './commands/create-activate-layer.cmd';
import { updateLayerCommand } from './commands/update-layer.cmd';
import { activateLayerCommand } from './commands/activate-layer.cmd';
import { removeAndActivateLayerCommand } from './commands/remove-activate-layer.cmd';

export interface LayersManagerOption {
	layersBus: BaseBusLayers;
	config: Config;
	historyManager: HistoryManager;
}

export interface ILayersManagerInternalOps
	extends Pick<EventEmitter<LayersManagerIEvents>, 'emit'> {
	getLayersFactory(): LayerFactory;
	getLayersListManager(): LayersListManager;
	getLayerSerializer(): LayerSerializer;
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
		this.bus.on('layer::create::request', () => this.addLayer());
		this.bus.on('layer::remove::request', ({ id }) => this.removeLayer(id));
		this.bus.on('layer::update::request', ({ id, ...rest }) => this.updateLayer(id, rest));
		this.bus.on('layer::change_active::request', ({ id }) => this.setActiveLayer(id));
	}

	private proxyLayerEvents(layer: ILayer) {
		layer.on('tile_change', (tile) => this.bus.emit('layer::tile::change', tile), this);
		layer.on('tile_deleted', ({ x, y, layerId }) =>
			this.bus.emit('layer::tile::removed', { x, y, layerId })
		);

		this.historyManager.registerTarget(`layer::${layer.id}`, layer);
	}

	public internalOps(): ILayersManagerInternalOps {
		return {
			getLayersFactory: () => this.layerFactory,
			getLayersListManager: () => this.layers,
			getLayerSerializer: () => this.layerSerializer,
			emit: this.emit.bind(this)
		};
	}

	private unproxyLayerEvents(layer: ILayer | null) {
		if (!layer) return;
		layer.off('tile_change');
		layer.off('tile_deleted');
	}

	public updateLayer(id: string, updates: DeepPartial<ILayerModel>): void {
		const command = new updateLayerCommand(this.internalOps(), this.historyManager, this.bus);
		command.execute(id, updates);
	}

	public addLayer(): [string, ILayer] {
		const command = new CreateAndActivateLayerCommand(
			this.internalOps(),
			this.historyManager,
			this.bus
		);
		const { id, layer } = command.execute();
		this.proxyLayerEvents(layer);
		return [id, layer];
	}

	public removeLayer(id: string): void {
		const command = new removeAndActivateLayerCommand(
			this.internalOps(),
			this.historyManager,
			this.bus
		);
		const layer = command.execute(id);
		this.unproxyLayerEvents(layer);
	}

	public setActiveLayer(id: string): void {
		if (id === this.getActiveLayer()?.id) return;
		const command = new activateLayerCommand(this.internalOps(), this.historyManager, this.bus);
		command.execute(id);
	}

	public insertLayer(id: string, layer: ILayer) {
		this.layers.addLayer(layer);
		this.proxyLayerEvents(layer);
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

		const tiles = layer.queryAllTiles();
		for (const tile of tiles) {
			this.bus.emit('layer::tile::change', { ...tile, layerId: layer.id });
		}
		this.proxyLayerEvents(layer);
	}

	public ensureLayer(): ILayer {
		let activeLayer = this.getLayer(this.getActiveLayerKey() || '');
		if (!activeLayer) {
			const command = new CreateAndActivateLayerCommand(
				this.internalOps(),
				this.historyManager,
				this.bus
			);
			const { layer } = command.execute();
			this.proxyLayerEvents(layer);

			activeLayer = layer;
		}
		return activeLayer;
	}

	public addTempLayer(index?: number): [string, ILayer] {
		const newIndex = index ?? this.getActiveLayer()?.index ?? 0;

		const [id, layer] = this.layerFactory.createTempLayer();
		layer.updateIndex(newIndex);
		this.tempLayers.insertLayerAtIndex(layer, newIndex);

		return [id, layer];
	}

	public removeTempLayer(id: string): void {
		const layer = this.getTempLayer(id);
		if (!layer) return;
		this.tempLayers.removeLayer(id);
	}

	public getLayer(key: string) {
		return this.layers.getLayerById(key) || null;
	}

	public getTempOrRealLayer(key: string) {
		return this.layers.getLayerById(key) || this.tempLayers.getLayerById(key) || null;
	}

	public getTempLayer(key: string) {
		return this.tempLayers.getLayerById(key) || null;
	}

	public getLayers() {
		return [...this.layers.getSortedLayers()];
	}

	public getTempLayers() {
		return [...this.tempLayers.getSortedLayers()];
	}

	public getActiveLayer(): ILayer | null {
		return this.getLayer(this.getActiveLayerKey() || '');
	}

	public getActiveLayerKey(): string | null {
		return this.layers.getActiveLayerKey() || null;
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

	public getBus(): BaseBusLayers {
		return this.bus;
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
}
