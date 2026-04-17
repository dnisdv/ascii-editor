import type {
	ILayerModel,
	RequireAtLeastOne,
	DeepPartial,
	ObjectOperation,
	LayerSerializableSchemaType
} from '@editor/types';
import { DocumentController } from './document';
import type { SmartObjectSerializableSchemaType } from '@editor/serializer/smart-object.schema';
import type { LayerGroupSerializableSchemaType } from '@editor/serializer/group.serializer.schema';

interface ApiDependencies {
	documentController: DocumentController;
	save: () => void;
}

export const LayersApi = ({ documentController, save }: ApiDependencies) => {
	let savePending = false;
	const scheduleSave = () => {
		if (!savePending) {
			savePending = true;
			Promise.resolve().then(() => {
				savePending = false;
				save();
			});
		}
	};

	return {
		listLayers(): string[] {
			return Object.keys(documentController.getSchema().layers.data);
		},

		moveLayer(layerId: string, newPosition: number): void {
			documentController.updateLayer(layerId, { index: newPosition });
			scheduleSave();
		},

		setActiveLayer(layerId: string | null): void {
			documentController.setActiveLayer(layerId);
			scheduleSave();
		},

		addLayer(layer: LayerSerializableSchemaType) {
			documentController.addLayer(layer);
			scheduleSave();
		},

		updateLayer(layer: RequireAtLeastOne<DeepPartial<ILayerModel>, 'id'>): void {
			const id = layer.id as string;
			documentController.updateLayer(id, layer as unknown as Partial<LayerSerializableSchemaType>);
			scheduleSave();
		},

		removeLayer(layerId: string): void {
			documentController.removeLayer(layerId);
			scheduleSave();
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
			scheduleSave();
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
			scheduleSave();
		},

		removeSmartObject(layerId: string, objectId: string): void {
			documentController.removeSmartObject(layerId, objectId);
			scheduleSave();
		},

		updateSmartObject(
			layerId: string,
			objectId: string,
			objectType: string,
			operation: ObjectOperation
		): void {
			documentController.doObjectOperation(layerId, objectId, objectType, operation);
			scheduleSave();
		},

		moveSmartObject(layerId: string, objectId: string, toIndex: number, orderKey?: string): void {
			documentController.moveSmartObject(layerId, objectId, toIndex, orderKey);
			scheduleSave();
		},

		addGroup(group: LayerGroupSerializableSchemaType): void {
			documentController.addGroup(group);
			scheduleSave();
		},

		removeGroup(groupId: string): void {
			documentController.removeGroup(groupId);
			scheduleSave();
		},

		updateGroup(groupId: string, updates: Partial<LayerGroupSerializableSchemaType>): void {
			documentController.updateGroup(groupId, updates);
			scheduleSave();
		}
	};
};
