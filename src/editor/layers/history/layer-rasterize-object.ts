import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { LayersManager } from '../layers-manager';
import type { LayersExecutionContext } from './history-context';
import type { SmartObjectSerializableSchemaType } from '@editor/serializer/smart-object.schema';
import type { Properties } from '@editor/objects/properties';

export const rasterizeLayerObject = createActionDefinition<
	'layer::rasterize_object',
	{ layerId: string; objectId: string },
	void
>('layer::rasterize_object');

export interface RasterizeObjectAction extends BaseAction {
	type: typeof rasterizeLayerObject.type;
	before: {
		layerId: string;
		object: SmartObjectSerializableSchemaType;
		orderKey?: string;
		regionSnapshot: string;
	};
	after: {
		layerId: string;
		objectId: string;
		x: number;
		y: number;
		text: string;
	};
}

function boundsFromSnapshot(
	props: Properties
): { x: number; y: number; width: number; height: number } {
	const t = props.transform;
	return {
		x: Math.round(t?.x?.value ?? 0),
		y: Math.round(t?.y?.value ?? 0),
		width: Math.max(1, Math.round(t?.width?.value ?? 1)),
		height: Math.max(1, Math.round(t?.height?.value ?? 1))
	};
}

export class RasterizeObjectHandler
	implements
		ActionHandler<
			RasterizeObjectAction,
			typeof rasterizeLayerObject._result,
			typeof rasterizeLayerObject._payload
		>
{
	public execute(
		target: LayersManager,
		context: LayersExecutionContext,
		payload: { layerId: string; objectId: string }
	): [RasterizeObjectAction, void] {
		void context;
		const layer = target.getRealLayer(payload.layerId);
		if (!layer)
			throw new Error(`Cannot rasterize: layer "${payload.layerId}" not found.`);

		const obj = layer.getObjectById(payload.objectId);
		if (!obj)
			throw new Error(`Cannot rasterize: object "${payload.objectId}" not found.`);

		const propsSnapshot = obj.properties.snapshot();
		const { x, y, width, height } = boundsFromSnapshot(propsSnapshot);

		const text = obj.toString() 

		const orderKey = layer.getOrderKey(payload.objectId);
		const serialized = obj.serialize();
		const regionSnapshot = layer.grid.readRegion(x, y, width, height);

		layer.grid.setToRegion(x, y, text);
		layer.removeObject(payload.objectId);

		return [
			{
				type: rasterizeLayerObject.type,
				targetId: 'layers',
				before: { layerId: payload.layerId, object: serialized, orderKey, regionSnapshot },
				after: { layerId: payload.layerId, objectId: payload.objectId, x, y, text }
			},
			undefined
		];
	}

	public apply(
		action: RasterizeObjectAction,
		target: LayersManager
	): void {
		const layer = target.getRealLayer(action.after.layerId);
		if (!layer) return;
		layer.grid.setToRegion(action.after.x, action.after.y, action.after.text);
		layer.removeObject(action.after.objectId);
	}

	public revert(
		action: RasterizeObjectAction,
		target: LayersManager,
		context: LayersExecutionContext
	): void {
		const layer = target.getRealLayer(action.before.layerId);
		if (!layer) return;
		const { x, y, width, height } = boundsFromSnapshot(action.before.object.properties as Properties);
		layer.grid.clearRegion(x, y, width, height);
		layer.grid.setToRegion(x, y, action.before.regionSnapshot);
		const obj = context.layerSerializer.deserializeObject(action.before.object);
		layer.addOrReplaceObject(
			obj,
			action.before.orderKey ? { orderKey: action.before.orderKey } : undefined
		);
	}
}
