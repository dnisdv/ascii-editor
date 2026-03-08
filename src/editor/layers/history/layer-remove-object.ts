import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { LayersManager } from '../layers-manager';
import type { LayersExecutionContext } from './history-context';
import type { SmartObjectSerializableSchemaType } from '@editor/serializer/smart-object.schema';

export const removeLayerObject = createActionDefinition<
	'layer::remove_object',
	{ layerId: string; objectId: string },
	void
>('layer::remove_object');

export interface LayerRemoveObjectAction extends BaseAction {
	type: typeof removeLayerObject.type;
	before: {
		layerId: string;
		object: SmartObjectSerializableSchemaType;
		orderKey?: string;
	};
	after: {
		layerId: string;
		objectId: string;
	};
}

export class LayerRemoveObject
	implements
		ActionHandler<
			LayerRemoveObjectAction,
			typeof removeLayerObject._result,
			typeof removeLayerObject._payload
		>
{
	public execute(
		target: LayersManager,
		context: LayersExecutionContext,
		payload: { layerId: string; objectId: string }
	): [LayerRemoveObjectAction, void] {
		void context;
		const layer = target.getRealLayer(payload.layerId);
		if (!layer)
			throw new Error(`Cannot remove object: Layer with ID "${payload.layerId}" not found.`);

		const obj = layer.getObjectById(payload.objectId);
		if (!obj)
			throw new Error(
				`Cannot remove object: Object with ID "${payload.objectId}" not found in layer.`
			);

		const orderKey = layer.getOrderKey(payload.objectId);
		const serialized = obj.serialize() as SmartObjectSerializableSchemaType;

		layer.removeObject(payload.objectId);

		return [
			{
				type: removeLayerObject.type,
				targetId: 'layers',
				before: { layerId: payload.layerId, object: serialized, orderKey },
				after: { layerId: payload.layerId, objectId: payload.objectId }
			},
			undefined
		];
	}

	public apply(
		action: LayerRemoveObjectAction,
		target: LayersManager,
		_context: LayersExecutionContext
	): void {
		void _context;
		const layer = target.getRealLayer(action.after.layerId);
		if (!layer) return;
		layer.removeObject(action.after.objectId);
	}

	public revert(
		action: LayerRemoveObjectAction,
		target: LayersManager,
		context: LayersExecutionContext
	): void {
		const layer = target.getRealLayer(action.before.layerId);
		if (!layer) return;
		const obj = context.layerSerializer.deserializeObject(action.before.object);
		layer.addOrReplaceObject(
			obj,
			action.before.orderKey ? { orderKey: action.before.orderKey } : undefined
		);
	}
}
