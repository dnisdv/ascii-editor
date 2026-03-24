import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import { isRotatable, type ISmartObject } from '@editor/objects/smart-object.interface';

export type RotationState = {
	x: number;
	y: number;
	width: number;
	height: number;
	content?: string;
};

export const objectRotationPatch = createActionDefinition<
	'object::rotation_patch',
	{ before: RotationState; after: RotationState },
	void
>('object::rotation_patch');

export interface ObjectRotationPatchAction extends BaseAction {
	type: typeof objectRotationPatch.type;
	targetId: string;
	before: RotationState;
	after: RotationState;
}

function applyState(target: ISmartObject, state: RotationState): void {
	target.properties.applyCommitted('transform.x', state.x);
	target.properties.applyCommitted('transform.y', state.y);
	target.properties.applyCommitted('transform.width', state.width);
	target.properties.applyCommitted('transform.height', state.height);
	if (state.content !== undefined && isRotatable(target)) {
		target.restoreRotationContent?.(state.content);
	}
	target.emit?.('update');
}

export class ObjectRotationPatchHandler
	implements
		ActionHandler<
			ObjectRotationPatchAction,
			void,
			{ before: RotationState; after: RotationState }
		>
{
	execute(
		target: ISmartObject,
		_ctx: unknown,
		payload: { before: RotationState; after: RotationState }
	): [ObjectRotationPatchAction | undefined, void] {
		applyState(target, payload.after);
		return [
			{
				type: objectRotationPatch.type,
				targetId: target.id,
				before: payload.before,
				after: payload.after
			},
			undefined
		];
	}

	apply(action: ObjectRotationPatchAction, target: ISmartObject): void {
		applyState(target, action.after);
	}

	revert(action: ObjectRotationPatchAction, target: ISmartObject): void {
		applyState(target, action.before);
	}
}
