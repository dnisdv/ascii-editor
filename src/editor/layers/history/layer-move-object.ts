import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { LayersManager } from '../layers-manager';
import type { LayersExecutionContext } from './history-context';

export const moveLayerObject = createActionDefinition<
	'layer::move_object',
	{ layerId: string; objectId: string; toIndex: number },
	void
>('layer::move_object');

export interface LayerMoveObjectAction extends BaseAction {
	type: typeof moveLayerObject.type;
	before: {
		layerId: string;
		objectId: string;
		fromIndex: number;
		orderKey: string;
	};
	after: {
		layerId: string;
		objectId: string;
		toIndex: number;
		orderKey: string;
	};
}

export class LayerMoveObject
	implements
		ActionHandler<
			LayerMoveObjectAction,
			typeof moveLayerObject._result,
			typeof moveLayerObject._payload
		>
{
	public execute(
		target: LayersManager,
		_context: LayersExecutionContext,
		payload: { layerId: string; objectId: string; toIndex: number }
	): [LayerMoveObjectAction, void] {
		const layer = target.getLayer(payload.layerId);

		if (!layer) {
			throw new Error(`Cannot move object: Layer with ID "${payload.layerId}" not found.`);
		}

		const beforeIndex = layer.getIndexOfObject(payload.objectId);
		const beforeOrderKey = layer.getOrderKey(payload.objectId);

		if (beforeIndex === -1 || !beforeOrderKey) {
			throw new Error(
				`Cannot move object: Object with ID "${payload.objectId}" not found in layer.`
			);
		}

		layer.moveObject(payload.objectId, payload.toIndex);

		const afterOrderKey = layer.getOrderKey(payload.objectId);
		if (!afterOrderKey) {
			throw new Error(`Failed to get order key after move for object "${payload.objectId}".`);
		}

		return [
			{
				type: moveLayerObject.type,
				targetId: 'layers',
				before: {
					layerId: payload.layerId,
					objectId: payload.objectId,
					fromIndex: beforeIndex,
					orderKey: beforeOrderKey
				},
				after: {
					layerId: payload.layerId,
					objectId: payload.objectId,
					toIndex: payload.toIndex,
					orderKey: afterOrderKey
				}
			},
			undefined
		];
	}

	apply(action: LayerMoveObjectAction, target: LayersManager): void {
		const layer = target.getLayer(action.after.layerId);
		if (!layer) return;

		layer.moveObject(action.after.objectId, action.after.toIndex);
	}

	revert(action: LayerMoveObjectAction, target: LayersManager): void {
		const layer = target.getLayer(action.before.layerId);
		if (!layer) return;

		layer.moveObject(action.before.objectId, action.before.fromIndex);
	}
}
