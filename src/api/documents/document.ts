// FAST WRITTEN, BAD CODE, WARNING:
import {
	DocumentSchema,
	LayerSerializableSchema,
	type DocumentSchemaType,
	type ILayerModel,
	type LayerSerializableSchemaType
} from '@editor/types';

export class DocumentController {
	private schema: DocumentSchemaType;

	constructor(defaultSchema?: DocumentSchemaType) {
		this.schema = defaultSchema ? this.initializeSchema(defaultSchema) : this.createDefaultSchema();
	}

	private initializeSchema(defaultSchema: DocumentSchemaType): DocumentSchemaType {
		this.validateSchema(defaultSchema);
		return defaultSchema;
	}

	private createDefaultSchema(): DocumentSchemaType {
		return {
			// WARNING: Hardcoded until multiple documents/document selection
			meta: { id: '__PROJECT__', version: '1.0', title: 'Untitled' },
			config: { tileSize: 25 },
			layers: { activeLayerKey: null, data: {} },
			camera: { offsetX: 0, offsetY: 0, scale: 3 },
			tools: { activeTool: null, data: {} },
			history: null
		};
	}

	private validateSchema(newSchema: DocumentSchemaType): void {
		const validation = DocumentSchema.safeParse(newSchema);
		if (!validation.success) {
			console.error('Schema validation failed:', validation.error);
			throw new Error('Invalid schema');
		}
	}

	private validateLayer(layer: LayerSerializableSchemaType): void {
		const validation = LayerSerializableSchema.safeParse(layer);
		if (!validation.success) {
			console.error('Layer validation failed:', validation.error);
			throw new Error('Invalid layer schema');
		}
	}

	private getLayerWithTileMap(layerId: string): LayerSerializableSchemaType {
		const layer = this.getLayerOrThrow(layerId);
		if (!layer.tileMap) {
			throw new Error(`Layer with id ${layerId} does not have a tileMap initialized.`);
		}
		return layer;
	}

	private tileKey(x: number, y: number): string {
		return `${x},${y}`;
	}

	private updateLayerIndex(
		layer: LayerSerializableSchemaType,
		newIndex: number,
		updates: Partial<LayerSerializableSchemaType>
	): void {
		delete this.schema.layers.data[layer.id];
		const sortedLayers = Object.values(this.schema.layers.data).sort((a, b) => a.index - b.index);
		sortedLayers.splice(newIndex, 0, { ...layer, ...updates });
		this.schema.layers.data = Object.fromEntries(
			sortedLayers.map((l, idx) => [l.id, { ...l, index: idx }])
		);
	}

	private mergeLayer(
		layer: LayerSerializableSchemaType,
		updates: Partial<LayerSerializableSchemaType>
	): LayerSerializableSchemaType {
		if (updates.tileMap) {
			return {
				...layer,
				...updates,
				tileMap: {
					...layer.tileMap,
					map: {
						...layer.tileMap?.map,
						...updates.tileMap.map
					}
				}
			};
		}
		return { ...layer, ...updates };
	}

	private reindexLayers(): void {
		const layers = Object.values(this.schema.layers.data).sort((a, b) => a.index - b.index);
		layers.forEach((layer, index) => (layer.index = index));
	}

	setSchema(newSchema: DocumentSchemaType): void {
		this.validateSchema(newSchema);
		this.schema = newSchema;
	}

	addLayer(layer: ILayerModel, hasTileMap = false): void {
		if (this.schema.layers.data[layer.id]) {
			throw new Error(`Layer with id ${layer.id} already exists.`);
		}

		const newLayer: LayerSerializableSchemaType = {
			...layer,
			tileMap: hasTileMap ? { map: {} } : undefined
		};

		this.validateLayer(newLayer);
		this.schema.layers.data[layer.id] = newLayer;
		this.schema.layers.activeLayerKey = layer.id;
	}

	removeLayer(layerId: string): void {
		this.getLayerOrThrow(layerId);
		delete this.schema.layers.data[layerId];
		if (this.schema.layers.activeLayerKey === layerId) {
			this.schema.layers.activeLayerKey = null;
		}
	}

	updateLayer(layerId: string, updates: Partial<LayerSerializableSchemaType>): void {
		const layer = this.getLayerOrThrow(layerId);

		if (updates.index !== undefined && updates.index !== layer.index) {
			this.updateLayerIndex(layer, updates.index, updates);
		} else {
			const updatedLayer = this.mergeLayer(layer, updates);
			this.validateLayer(updatedLayer);
			this.schema.layers.data[layerId] = updatedLayer;
		}
		this.reindexLayers();
	}

	setActiveLayer(layerId: string | null): void {
		this.schema.layers.activeLayerKey = layerId;
	}

	private getLayerOrThrow(layerId: string): LayerSerializableSchemaType {
		const layer = this.schema.layers.data[layerId];
		if (!layer) {
			throw new Error(`Layer with id ${layerId} does not exist.`);
		}
		return layer;
	}

	addTile(layerId: string, x: number, y: number, data: string): void {
		const layer = this.getLayerWithTileMap(layerId);
		const key = this.tileKey(x, y);
		if (layer.tileMap?.map[key]) {
			throw new Error(`Tile at position (${x}, ${y}) already exists.`);
		}
		if (layer.tileMap) {
			layer.tileMap.map[key] = { tileSize: this.schema.config.tileSize, x, y, data };
		}
	}

	removeTile(layerId: string, x: number, y: number): void {
		const layer = this.getLayerWithTileMap(layerId);
		const key = this.tileKey(x, y);
		if (!layer.tileMap?.map[key]) {
			throw new Error(`Tile at position (${x}, ${y}) does not exist.`);
		}
		delete layer.tileMap.map[key];
	}

	updateTile(layerId: string, x: number, y: number, data: string): void {
		const layer = this.getLayerWithTileMap(layerId);
		const key = this.tileKey(x, y);
		if (!layer.tileMap?.map[key]) {
			throw new Error(`Tile at position (${x}, ${y}) does not exist.`);
		}
		layer.tileMap.map[key].data = data;
	}

	getSchema(): DocumentSchemaType {
		return this.schema;
	}
}
