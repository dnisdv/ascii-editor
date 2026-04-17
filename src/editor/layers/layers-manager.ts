import type { HistoryManager } from '@editor/history-manager';
import type { Config } from '@editor/config';
import { type DeepPartial, LayerSerializer } from '@editor/types';
import { LayerFactory } from './layer-factory';
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
	setLayerChar,
	addGroup,
	GroupAdd,
	removeGroup as removeGroupAction,
	GroupRemove,
	updateGroup as updateGroupAction,
	GroupUpdate,
	groupLayersAction,
	GroupLayers,
	ungroupLayersAction,
	UngroupLayers,
	toggleGroupVisibilityAction,
	ToggleGroupVisibility
} from './history';
import { createLayerInGroup, LayerCreateInGroup } from './history/layer-create-in-group';
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
import { MoveLayers, moveLayers } from './history/move-layers';
import { LayerController } from './layer-api';
import { Layer } from './layer';
import type { ILayerModel } from '@editor/types/external/layer-model';
import type { LayersManagerEvents } from '@editor/types/external/layers-events';
import type { LayersExecutionContext } from './history/history-context';
import { LayerRenameObject } from './history/layer-rename-object';
import { LayerGroupManager } from './layer-group-manager';
import type { ILayerGroup } from '@editor/types/external/layer-group';
import { LayerSelectionManager } from './layer-selection-manager';
import { ScopeIndexAllocator } from './scope-index-allocator';
import { bucketBy } from '@editor/utils';

export interface LayerMoveItem {
	id: string;
	kind: 'layer' | 'group';
	newParentId?: string | null;
	newIndex: number;
}

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
	private groupManager: LayerGroupManager;
	private selectionManager: LayerSelectionManager;

	private layerFactory: LayerFactory;
	private historyManager: HistoryManager;
	private layerSerializer: LayerSerializer;
	private config: Config;

	private tempLayerAssociations: Map<string, string> = new Map();
	private overlayAssociations: Map<string, string> = new Map();

	constructor({ config, historyManager, layerSerializer }: LayersManagerDeps) {
		super();

		this.config = config;
		this.layerSerializer = layerSerializer;
		this.historyManager = historyManager;

		const scopeIndex = ScopeIndexAllocator.forLayersAndGroups(
			() => this.layers.getSortedLayers(),
			() => this.groupManager.getGroups()
		);

		this.layers = new LayersListManager(scopeIndex);
		this.tempLayers = new TempLayersListManager();
		this.groupManager = new LayerGroupManager(scopeIndex);
		this.selectionManager = new LayerSelectionManager(() => this.getTreeSortedLayers());
		this.layerFactory = new LayerFactory({
			config: this.config,
			objectHistoryBinder: {
				bind: (obj: { id: string }) => {
					try {
						this.historyManager.registerTarget(obj.id, obj);
						this.historyManager.registerContext(obj.id, {});
					} catch {
						void 0;
					}
				}
			}
		});

		this.proxy(this.layers, {
			events: ['layer::added', 'layer::removed', 'layer::active::changed']
		});
		this.proxy(this.groupManager, {
			events: ['group::added', 'group::removed', 'group::updated']
		});
		this.proxy(this.selectionManager, {
			events: ['layer::selection::changed']
		});

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

		this.historyManager.registerHandler(addGroup, new GroupAdd());
		this.historyManager.registerHandler(removeGroupAction, new GroupRemove());
		this.historyManager.registerHandler(updateGroupAction, new GroupUpdate());
		this.historyManager.registerHandler(moveLayers, new MoveLayers());
		this.historyManager.registerHandler(groupLayersAction, new GroupLayers());
		this.historyManager.registerHandler(ungroupLayersAction, new UngroupLayers());
		this.historyManager.registerHandler(toggleGroupVisibilityAction, new ToggleGroupVisibility());
		this.historyManager.registerHandler(createLayerInGroup, new LayerCreateInGroup());

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

	public addOverlayTempLayer(index?: number, sourceLayerId?: string): [string, LayerController] {
		const [id, tempLayer] = this.layerFactory.createTempLayer();
		this.proxyTempLayerEvents(tempLayer);
		if (typeof index === 'number') tempLayer.update({ index });
		this.tempLayers.addLayer(tempLayer);
		if (sourceLayerId) this.overlayAssociations.set(id, sourceLayerId);
		this.emit('temp_layer::added', { layer: tempLayer as Layer });
		return [id, new LayerController(tempLayer as Layer, this)];
	}

	public removeTempLayer(id: string): void {
		const layer = this.tempLayers.getLayerById(id);
		if (layer) {
			this.tempLayers.removeLayer(id);
			this.unproxyTempLayerEvents(layer);

			this.tempLayerAssociations.delete(id);
			this.overlayAssociations.delete(id);
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

	public getFullComposition(layerId: string): Layer[] {
		const composition = this.getLayerComposition(layerId);
		for (const [tempId, sourceId] of this.overlayAssociations.entries()) {
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
		return [...this.getTreeSortedLayers()];
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
		const allLayers = [...this.getTreeSortedLayers(), ...this.tempLayers.getSortedLayers()];
		return allLayers.filter((layer) => layer.getOpts().visible);
	}

	public getTreeSortedLayers(): Layer[] {
		const layersByScope = bucketBy(this.layers.getSortedLayers(), (l) => l.groupId ?? null);
		const groupsByParent = bucketBy(this.groupManager.getGroups(), (g) => g.parentId ?? null);

		const result: Layer[] = [];

		const flatten = (parentId: string | null) => {

			const children = [
				...(groupsByParent.get(parentId) ?? []).map((g) => ({ index: g.index, kind: 'g' as const, id: g.id })),
				...(layersByScope.get(parentId) ?? []).map((l) => ({ index: l.index, kind: 'l' as const, ref: l }))
			].sort((a, b) => a.index - b.index);

			for (const c of children) {
				if (c.kind === 'g') flatten(c.id);
				else result.push(c.ref as Layer);
			}
		};

		flatten(null);
		return result;
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
		const realLayers = this.getTreeSortedLayers();
		const tempLayers = this.tempLayers.getSortedLayers();

		const visibleReal = realLayers.filter((layer: Layer) => layer.getOpts().visible);
		const visibleTemp = tempLayers.filter((layer: Layer) => layer.getOpts().visible);

		const combined = [...visibleReal, ...visibleTemp];

		combined.sort((a, b) => {
			const realIndexOf = (l: Layer) => {
				const ri = realLayers.indexOf(l);
				return ri !== -1 ? ri : l.index;
			};
			const indexDiff = realIndexOf(a) - realIndexOf(b);

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
		const allLayers = [...this.getTreeSortedLayers()];
		return allLayers.filter((layer) => layer.getOpts().visible);
	}

	public getVisibleTempLayers() {
		const allLayers = [...this.tempLayers.getSortedLayers()];
		return allLayers.filter((layer) => layer.getOpts().visible);
	}

	public getSelectionManager(): LayerSelectionManager {
		return this.selectionManager;
	}

	public getSelectedLayerIds(): string[] {
		return this.selectionManager.getSelectedLayerIds();
	}

	public isLayerSelected(id: string): boolean {
		return this.selectionManager.isLayerSelected(id);
	}

	public selectLayer(id: string, addToSelection = false): void {
		this.selectionManager.selectLayer(id, addToSelection);
	}

	public deselectLayer(id: string): void {
		this.selectionManager.deselectLayer(id);
	}

	public toggleLayerSelection(id: string): void {
		this.selectionManager.toggleLayerSelection(id);
	}

	public selectLayerRange(fromId: string, toId: string): void {
		this.selectionManager.selectLayerRange(fromId, toId);
	}

	public clearLayerSelection(): void {
		this.selectionManager.clearLayerSelection();
	}

	public createGroup(name: string, parentId: string | null = null): ILayerGroup {
		const group = this.groupManager.createGroupObject(name, parentId);
		this.historyManager.execute(addGroup, 'layers', { group });
		return group;
	}

	public groupLayers(layerIds: string[], groupName: string = 'Group'): ILayerGroup | null {
		if (layerIds.length === 0) return null;

		const resolvedLayers = layerIds
			.map((id) => this.layers.getLayerById(id))
			.filter((l): l is Layer => !!l);

		if (resolvedLayers.length === 0) return null;

		const firstLayer = resolvedLayers[0];
		const parentGroupId = firstLayer.groupId ?? null;

		const group = this.groupManager.createGroupObject(groupName, parentGroupId);

		return this.historyManager.execute(groupLayersAction, 'layers', {
			layerIds,
			groupName,
			group
		});
	}

	public removeGroup(id: string, removeChildren: boolean = false): void {
		if (!this.groupManager.hasGroup(id)) return;
		this.historyManager.execute(ungroupLayersAction, 'layers', { id, removeChildren });
	}

	public updateGroup(id: string, updates: DeepPartial<ILayerGroup>): void {
		this.historyManager.execute(updateGroupAction, 'layers', { id, changes: updates });
	}

	public getGroup(id: string): ILayerGroup | undefined {
		return this.groupManager.getGroup(id);
	}

	public getGroups(): ILayerGroup[] {
		return this.groupManager.getGroups();
	}

	private getLayersInGroup(groupId: string): Layer[] {
		return this.layers.getSortedLayers().filter((l) => l.groupId === groupId);
	}

	public addLayerToGroup(layerId: string, groupId: string): void {
		if (!this.groupManager.hasGroup(groupId)) return;
		this.updateLayer(layerId, { groupId });
	}

	public addLayerInGroup(groupId: string): [string, LayerController] | null {
		if (!this.groupManager.hasGroup(groupId)) return null;
		const { id, layer } = this.historyManager.execute(createLayerInGroup, 'layers', { groupId });
		return [id, new LayerController(layer as Layer, this)];
	}

	public removeLayerFromGroup(layerId: string): void {
		this.updateLayer(layerId, { groupId: null });
	}

	public toggleGroupVisibility(groupId: string): void {
		const group = this.groupManager.getGroup(groupId);
		if (!group) return;
		this.historyManager.execute(toggleGroupVisibilityAction, 'layers', { groupId });
	}

	public setGroupCollapsed(id: string, collapsed: boolean): void {
		this.groupManager.updateGroup(id, { collapsed });
	}

	public getGroupManager(): LayerGroupManager {
		return this.groupManager;
	}

	public moveLayers(items: LayerMoveItem[]): void {
		if (items.length === 0) return;
		this.historyManager.execute(moveLayers, 'layers', items);
	}
}
