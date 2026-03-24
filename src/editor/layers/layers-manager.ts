import type { HistoryManager } from '@editor/history-manager';
import type { Config } from '@editor/config';
import { type DeepPartial, LayerSerializer } from '@editor/types';
import { LayerFactory } from './layer-factory';
import type { ObjectHistoryBinder } from './object-history-binder';
import { EventEmitter } from '@editor/event-emitter';
import { LayersListManager } from './layer-list-manager';
import { TempLayersListManager } from './templayer-list-manager';
import {
	changeActiveLayer,
	createAndActivateLayer,
	LayerCreateAndActivate,
	LayersChangeActive,
	LayerRemoveObject,
	removeLayerObject,
	renameLayerObject,
	SetCharHandler,
	setLayerChar
} from './history';
import { objectSetProperty, SetPropertyHandler } from '@editor/objects/history/setProperty';
import {
	objectPropertiesPatch,
	ObjectPropertiesPatchHandler
} from '@editor/objects/history/object-properties-patch';
import {
	objectAnchorsPatch,
	ObjectAnchorsPatchHandler
} from '@editor/objects/history/object-anchors-patch';
import {
	objectRotationPatch,
	ObjectRotationPatchHandler
} from '@editor/objects/history/object-rotation-patch';
import { LayerUpdate, updateLayer } from './history/layer-update';
import {
	LayerRemoveAndActivate,
	removeAndActivateLayer
} from './history/layer-remove-and-activate';
import { LayerMoveObject, moveLayerObject } from './history/layer-move-object';
import { LayerController } from './layer-api';
import { Layer } from './layer';
import type { ILayerModel } from '@editor/types/external/layer-model';
import type { LayersManagerEvents } from '@editor/types/external/layers-events';
import type { LayersExecutionContext } from './history/history-context';
import { LayerRenameObject } from './history/layer-rename-object';

export interface LayersManagerDeps {
	config: Config;
	historyManager: HistoryManager;
	layerSerializer: LayerSerializer;
}

export interface ILayersManagerInternalOps extends Pick<EventEmitter<LayersManagerEvents>, 'emit'> {
	getLayersFactory(): LayerFactory;
	getLayersListManager(): LayersListManager;
	getLayerSerializer(): LayerSerializer;
}

export class LayersManager extends EventEmitter<LayersManagerEvents> {
	private layers: LayersListManager;
	private tempLayers: TempLayersListManager;

	private layerFactory: LayerFactory;
	private historyManager: HistoryManager;
	private layerSerializer: LayerSerializer;
	private config: Config;

	private tempLayerAssociations: Map<string, string> = new Map();

	constructor({ config, historyManager, layerSerializer }: LayersManagerDeps) {
		super();
		this.config = config;
		this.layerSerializer = layerSerializer;

		this.layers = new LayersListManager();
		this.proxy(this.layers, {
			events: ['layer::added', 'layer::removed', 'layer::active::changed']
		});

		this.tempLayers = new TempLayersListManager();
		const binder: ObjectHistoryBinder = {
			bind: (obj: { id: string }) => {
				try {
					this.historyManager.registerTarget(obj.id, obj);
					this.historyManager.registerContext(obj.id, {});
				} catch {
					void 0;
				}
			}
		};
		this.layerFactory = new LayerFactory({ config: this.config, objectHistoryBinder: binder });

		this.historyManager = historyManager;
		this.historyManager.registerTarget('layers', this);
		this.registerHistoryHandlers();
		this.registerHistoryContext();

		(window as unknown as { lmanager?: LayersManager }).lmanager = this;
	}

	private registerHistoryContext() {
		const executionContext: LayersExecutionContext = {
			layerSerializer: this.layerSerializer,
			layerFactory: this.layerFactory,
			layersListManager: this.layers,
			layersManager: this
		};
		this.historyManager.registerContext('layers', executionContext);
	}

	private registerHistoryHandlers() {
		this.historyManager.registerHandler(setLayerChar, new SetCharHandler());
		this.historyManager.registerHandler(updateLayer, new LayerUpdate());
		this.historyManager.registerHandler(changeActiveLayer, new LayersChangeActive());
		this.historyManager.registerHandler(createAndActivateLayer, new LayerCreateAndActivate());
		this.historyManager.registerHandler(removeAndActivateLayer, new LayerRemoveAndActivate());
		this.historyManager.registerHandler(moveLayerObject, new LayerMoveObject());
		this.historyManager.registerHandler(removeLayerObject, new LayerRemoveObject());
		this.historyManager.registerHandler(renameLayerObject, new LayerRenameObject());

		this.historyManager.registerHandler(objectSetProperty, new SetPropertyHandler());
		this.historyManager.registerHandler(objectPropertiesPatch, new ObjectPropertiesPatchHandler());
		this.historyManager.registerHandler(objectAnchorsPatch, new ObjectAnchorsPatchHandler());
		this.historyManager.registerHandler(objectRotationPatch, new ObjectRotationPatchHandler());
	}

	private proxyLayerEvents(layer: Layer) {
		this.proxy(layer, {
			prefixes: ['layer::', `layer::${layer.id}::`],
			events: [
				'object::op',
				'object::added',
				'object::moved',
				'object::update',
				'updated',
				'object::removed'
			],
			transform: (_, payload) => {
				return {
					...payload,
					layerId: layer.id
				};
			}
		});
		this.historyManager.registerTarget(`layer::${layer.id}`, layer);
		this.historyManager.registerContext(`layer::${layer.id}`, {});
	}

	private unproxyLayerEvents(layer: Layer | null) {
		if (layer) this.unproxy(layer);
	}

	private proxyTempLayerEvents(layer: Layer) {
		this.proxy(layer, {
			prefixes: ['temp_layer::', `temp_layer::${layer.id}::`],
			events: [
				'object::op',
				'object::added',
				'object::moved',
				'object::update',
				'updated',
				'object::removed'
			],
			transform: (_, payload) => {
				return {
					...payload,
					layerId: layer.id
				};
			}
		});
	}

	private unproxyTempLayerEvents(layer: Layer | null) {
		if (layer) this.unproxy(layer);
	}

	public internalOps(): ILayersManagerInternalOps {
		return {
			getLayersFactory: () => this.layerFactory,
			getLayersListManager: () => this.layers,
			getLayerSerializer: () => this.layerSerializer,
			emit: this.emit.bind(this)
		};
	}

	public updateLayer(id: string, updates: DeepPartial<ILayerModel>): void {
		this.historyManager.execute(updateLayer, 'layers', { id, changes: updates });
	}

	public addLayer(): [string, LayerController] {
		const { id, layer } = this.historyManager.execute(createAndActivateLayer, 'layers');
		this.proxyLayerEvents(layer);
		return [id, new LayerController(layer as Layer, this)];
	}

	public removeLayer(id: string): void {
		const layer = this.layers.getLayerById(id);
		if (!layer) return;

		this.historyManager.execute(removeAndActivateLayer, 'layers', { id });
		if (layer) this.unproxyLayerEvents(layer);
	}

	public setActiveLayer(id: string): void {
		if (id === this.getActiveLayer()?.id) return;
		this.historyManager.execute(changeActiveLayer, 'layers', { id });
	}

	public moveLayerObject(
		layerId: string,
		objectId: string,
		toIndex: number,
		batchId?: string
	): void {
		this.historyManager.execute(moveLayerObject, 'layers', { layerId, objectId, toIndex }, batchId);
	}

	public removeLayerObject(layerId: string, objectId: string): void {
		this.historyManager.execute(removeLayerObject, 'layers', { layerId, objectId });
	}

	public renameObject(layerId: string, objectId: string, name: string): void {
		const composition = this.getLayerComposition(layerId);
		if (composition.length === 0) return;
		const existsInComposition = composition.some((l) => !!l.getObjectById(objectId));
		if (!existsInComposition) return;
		this.historyManager.execute(renameLayerObject, 'layers', { layerId, objectId, name });
	}

	public renameLayerObject(layerId: string, objectId: string, name: string): void {
		this.renameObject(layerId, objectId, name);
	}

	public ensureLayer(): LayerController {
		let activeLayer = this.getLayer(this.getActiveLayerKey() || '');
		if (!activeLayer) activeLayer = this.addLayer()[1];
		return activeLayer!;
	}

	public addTempLayer(sourceLayerId: string): [string, LayerController] {
		const idToUse = sourceLayerId;
		const [id, tempLayer] = this.layerFactory.createTempLayer();

		this.proxyTempLayerEvents(tempLayer);

		const sourceLayer = this.layers.getLayerById(idToUse);
		if (!sourceLayer) {
			throw new Error(`addTempLayer failed: Source layer with id ${idToUse} not found.`);
		}

		tempLayer.update({ index: sourceLayer.index });
		this.tempLayers.addLayer(tempLayer);

		this.tempLayerAssociations.set(id, idToUse);
		this.emit('temp_layer::added', { layer: tempLayer as Layer });

		return [id, new LayerController(tempLayer as Layer, this)];
	}

	public addOverlayTempLayer(index?: number): [string, LayerController] {
		const [id, tempLayer] = this.layerFactory.createTempLayer();
		this.proxyTempLayerEvents(tempLayer);
		if (typeof index === 'number') tempLayer.update({ index });
		this.tempLayers.addLayer(tempLayer);
		this.emit('temp_layer::added', { layer: tempLayer as Layer });
		return [id, new LayerController(tempLayer as Layer, this)];
	}

	public removeTempLayer(id: string): void {
		const layer = this.tempLayers.getLayerById(id);
		if (layer) {
			this.tempLayers.removeLayer(id);
			this.unproxyTempLayerEvents(layer);

			this.tempLayerAssociations.delete(id);
			this.emit('temp_layer::removed', { id });
		}
	}

	public _attachTempLayerInternal(realLayerId: string): [string, LayerController] {
		return this.addTempLayer(realLayerId);
	}

	public getAttachedTempLayers(realLayerId: string): string[] {
		const ids: string[] = [];
		for (const [tempId, sourceId] of this.tempLayerAssociations.entries()) {
			if (sourceId === realLayerId) ids.push(tempId);
		}
		return ids;
	}

	public getLayerComposition(layerId: string): Layer[] {
		const baseLayer = this.layers.getLayerById(layerId) || this.tempLayers.getLayerById(layerId);
		if (!baseLayer) return [];

		const composition: Layer[] = [baseLayer];
		for (const [tempId, sourceId] of this.tempLayerAssociations.entries()) {
			if (sourceId === layerId) {
				const tempLayer = this.tempLayers.getLayerById(tempId);
				if (tempLayer) composition.push(tempLayer);
			}
		}
		return composition;
	}

	public _getLayerController(layer: Layer | null) {
		if (!layer) return null;
		return new LayerController(layer as Layer, this);
	}

	public getRealLayer(key: string) {
		return this.layers.getLayerById(key) || null;
	}

	public getLayer(key: string) {
		return this._getLayerController(this.layers.getLayerById(key) || null);
	}

	public getTempOrRealLayer(key: string): Layer | null {
		return this.layers.getLayerById(key) || this.tempLayers.getLayerById(key) || null;
	}

	public _getTempLayerInternal(key: string) {
		return this.tempLayers.getLayerById(key) || null;
	}

	public getLayers() {
		return [...this.layers.getSortedLayers()];
	}

	public _getTempLayersInternal() {
		return [...this.tempLayers.getSortedLayers()];
	}

	public getActiveLayer(): LayerController | null {
		return this.getLayer(this.getActiveLayerKey() || '');
	}

	public getActiveLayerKey(): string | null {
		return this.layers.getActiveLayerKey() || null;
	}

	public clearLayers(): void {
		this.layers.clear();
	}

	public clearTempLayers(): void {
		const ids = this._getTempLayersInternal().map((l) => l.id);
		for (const id of ids) this.removeTempLayer(id);
		this.tempLayerAssociations.clear();
	}

	public _clearTempLayersInternal(): void {
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

		const visibleReal = realLayers.filter((layer: Layer) => layer.getOpts().visible);
		const visibleTemp = tempLayers.filter((layer: Layer) => layer.getOpts().visible);

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
}
