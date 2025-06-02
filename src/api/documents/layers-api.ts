import type { DocumentSchemaType, ILayerModel, RequireAtLeastOne } from '@editor/types';
import { DBLocalStorage } from './db-localstorage';
import { DocumentsApi } from './document-api';
import { DocumentController } from './document';

export const LayersApi = (documentId: string) => ({
	listLayers(): string[] {
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		const documentController = new DocumentController(documentSchema);

		const layerIds = Object.keys(documentController.getSchema().layers.data);
		return layerIds;
	},

	moveLayer(layerId: string, newPosition: number): void {
		const db = new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`);
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		const documentController = new DocumentController(documentSchema);

		const layer = documentController.getSchema().layers.data[layerId];
		if (!layer) {
			throw new Error(`Layer with ID ${layerId} does not exist.`);
		}

		documentController.updateLayer(layerId, { index: newPosition });
		db.save(documentController.getSchema());
	},

	setActiveLayer(layerId: string | null): void {
		const db = new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`);
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		const documentController = new DocumentController(documentSchema);

		documentController.setActiveLayer(layerId);

		db.save(documentController.getSchema());
	},

	addLayer(layer: ILayerModel) {
		const db = new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`);
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		const documentController = new DocumentController(documentSchema);

		documentController.addLayer(layer);

		db.save(documentController.getSchema());
	},

	updateLayer(layer: RequireAtLeastOne<ILayerModel, 'id'>): void {
		const db = new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`);
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		const documentController = new DocumentController(documentSchema);

		const layerId = layer.id!;
		documentController.updateLayer(layerId, layer);

		db.save(documentController.getSchema());
	},

	removeTile(layerId: string, x: number, y: number): void {
		const db = new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`);
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		const documentController = new DocumentController(documentSchema);

		documentController.removeTile(layerId, x, y);

		db.save(documentController.getSchema());
	},

	removeLayer(layerId: string): void {
		const db = new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`);
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		const documentController = new DocumentController(documentSchema);

		documentController.removeLayer(layerId);

		db.save(documentController.getSchema());
	},

	updateTile(layerId: string, x: number, y: number, newData: string): void {
		const db = new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`);
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		const documentController = new DocumentController(documentSchema);

		let layer = documentController.getSchema().layers.data[layerId];
		if (!layer) {
			throw new Error(`Layer with ID ${layerId} does not exist.`);
		}

		if (!layer.tileMap) {
			documentController.updateLayer(layerId, {
				tileMap: {
					map: {}
				}
			});

			layer = documentController.getSchema().layers.data[layerId];
		}

		const tileKey = `${x},${y}`;
		const tileMap = layer.tileMap!.map;

		if (!tileMap[tileKey]) {
			tileMap[tileKey] = {
				tileSize: documentSchema.config.tileSize,
				x,
				y,
				data: newData
			};
		} else {
			tileMap[tileKey].data = newData;
		}

		db.save(documentController.getSchema());
	},

	duplicateLayer(layerId: string): void {
		const db = new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`);
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		const documentController = new DocumentController(documentSchema);

		const originalLayer = documentController.getSchema().layers.data[layerId];
		if (!originalLayer) {
			throw new Error(`Layer with ID ${layerId} does not exist.`);
		}

		const newLayerId = `${layerId}_copy`;
		const duplicatedLayer = {
			...originalLayer,
			id: newLayerId,
			name: `${originalLayer.name} (Copy)`
		};

		documentController.addLayer(duplicatedLayer);

		db.save(documentController.getSchema());
	}
});
