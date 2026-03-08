import type {
	ILayerModel,
	RequireAtLeastOne,
	DeepPartial,
	ObjectOperation,
	LayerSerializableSchemaType
} from '@editor/types';
import { DocumentController } from './document';
import type { SmartObjectSerializableSchemaType } from '@editor/serializer/smart-object.schema';

interface ApiDependencies {
	documentController: DocumentController;
	save: () => void;
}

export const LayersApi = ({ documentController, save }: ApiDependencies) => {
	return {
		listLayers(): string[] {
			return Object.keys(documentController.getSchema().layers.data);
		},

		moveLayer(layerId: string, newPosition: number): void {
			documentController.updateLayer(layerId, { index: newPosition });
			save();
		},

		setActiveLayer(layerId: string | null): void {
			documentController.setActiveLayer(layerId);
			save();
		},

		addLayer(layer: LayerSerializableSchemaType) {
			documentController.addLayer(layer);
			save();
		},

		updateLayer(layer: RequireAtLeastOne<DeepPartial<ILayerModel>, 'id'>): void {
			const id = layer.id as string;
			documentController.updateLayer(id, layer as unknown as Partial<LayerSerializableSchemaType>);
			save();
		},

		removeLayer(layerId: string): void {
			documentController.removeLayer(layerId);
			save();
		},

		duplicateLayer(layerId: string): void {
			const originalLayer = documentController.getSchema().layers.data[layerId];
			if (!originalLayer) {
				throw new Error(`Layer with ID ${layerId} does not exist.`);
			}

			const newLayerId = `${layerId}_copy_${Date.now()}`;
			const duplicatedLayer: LayerSerializableSchemaType = {
				...originalLayer,
				id: newLayerId,
				name: `${originalLayer.name} (Copy)`,
				index: Object.keys(documentController.getSchema().layers.data).length
			};

			documentController.addLayer(duplicatedLayer);
			save();
		},

		addSmartObject(
			layerId: string,
			objectId: string,
			objectType: string,
			toIndex: number,
			data: SmartObjectSerializableSchemaType,
			orderKey?: string
		): void {
			documentController.addSmartObject(layerId, objectId, objectType, toIndex, data, orderKey);
			save();
		},

		removeSmartObject(layerId: string, objectId: string): void {
			documentController.removeSmartObject(layerId, objectId);
			save();
		},

		updateSmartObject(
			layerId: string,
			objectId: string,
			objectType: string,
			operation: ObjectOperation
		): void {
			documentController.doObjectOperation(layerId, objectId, objectType, operation);
			save();
		},

		moveSmartObject(layerId: string, objectId: string, toIndex: number, orderKey?: string): void {
			documentController.moveSmartObject(layerId, objectId, toIndex, orderKey);
			save();
		}
	};
};
