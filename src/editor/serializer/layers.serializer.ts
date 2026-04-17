import type { LayerSerializer } from '@editor/types';
import type { LayersSerializableSchemaType } from './layers.serializer.schema';
import type { LayersManager } from '@editor/layers/layers-manager';

export class LayersSerializer {
	constructor(
		private layerSerializer: LayerSerializer,
		private layersManager: LayersManager
	) {}

	serialize(): LayersSerializableSchemaType {
		const layersManager = this.layersManager;
		const serialized: LayersSerializableSchemaType = {
			activeLayerKey: this.layersManager.getActiveLayerKey(),
			data: {},
			groups: {}
		};

		layersManager.getLayers().forEach((layer) => {
			serialized.data[layer.id] = this.layerSerializer.serialize(layer);
		});

		layersManager.getGroups().forEach((group) => {
			serialized.groups![group.id] = {
				id: group.id,
				name: group.name,
				collapsed: group.collapsed,
				parentId: group.parentId,
				index: group.index,
				opts: group.opts
			};
		});

		return serialized;
	}

	deserialize(data: LayersSerializableSchemaType): void {
		const layersManager = this.layersManager;

		layersManager.withSuspended(() => {
			layersManager.clearLayers();
			layersManager['groupManager'].clear();

			if (data.groups) {
				const groupIds = new Set(Object.keys(data.groups));

				for (const groupData of Object.values(data.groups)) {

					const parentId =
						groupData.parentId && groupIds.has(groupData.parentId)
							? groupData.parentId
							: null;

					layersManager['groupManager'].addGroup({
						id: groupData.id,
						name: groupData.name,
						collapsed: groupData.collapsed,
						parentId,
						index: groupData.index,
						opts: groupData.opts
					});
				}
			}

			const validGroupIds = new Set(layersManager.getGroups().map((g) => g.id));
			const layers = Object.values(data.data).map((layerData) => {
				const layer = this.layerSerializer.deserialize(layerData);

				if (layer.groupId && !validGroupIds.has(layer.groupId)) {
					layer.groupId = null;
				}
				return layer;
			});

			layers.forEach((layer) => {
				layersManager['layers'].insertLayerAtIndex(layer, layer.index);
				layersManager['proxyLayerEvents'](layer);
			});

			this.normalizeIndices(layersManager);

			if (data.activeLayerKey) {
				layersManager['layers'].setActiveLayer(data.activeLayerKey);
			}
		});
	}

	private normalizeIndices(layersManager: LayersManager): void {
		const allLayers = layersManager['layers'].getSortedLayers();
		const allGroups = layersManager.getGroups();

		const scopes = new Set<string | null>();
		for (const l of allLayers) scopes.add(l.groupId ?? null);
		for (const g of allGroups) scopes.add(g.parentId ?? null);

		for (const scopeId of scopes) {
			const entries: { id: string; kind: 'layer' | 'group'; index: number }[] = [];
			for (const l of allLayers) {
				if ((l.groupId ?? null) === scopeId) {
					entries.push({ id: l.id, kind: 'layer', index: l.index });
				}
			}
			for (const g of allGroups) {
				if ((g.parentId ?? null) === scopeId) {
					entries.push({ id: g.id, kind: 'group', index: g.index });
				}
			}

			entries.sort((a, b) => a.index - b.index);

			let idx = 0;
			for (const entry of entries) {
				if (entry.index !== idx) {
					if (entry.kind === 'layer') {
						const layer = layersManager['layers'].getLayerById(entry.id);
						if (layer) layer.update({ index: idx });
					} else {
						layersManager['groupManager'].updateGroup(entry.id, { index: idx });
					}
				}
				idx++;
			}
		}
	}
}
