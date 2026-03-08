import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { ISmartObject, SmartObjectAnchor } from '@editor/objects/smart-object.interface';

export const objectAnchorsPatch = createActionDefinition<
	'object::anchors_patch',
	{ anchors: Array<{ x: number; y: number }>; before?: Array<{ x: number; y: number }> },
	void
>('object::anchors_patch');

export interface ObjectAnchorsPatchAction extends BaseAction {
	type: typeof objectAnchorsPatch.type;
	targetId: string;
	before: { anchors: Array<{ x: number; y: number }> };
	after: { anchors: Array<{ x: number; y: number }> };
}

function getAbsAnchors(target: ISmartObject): Array<{ x: number; y: number }> {
	const anchors: SmartObjectAnchor[] = target.getAnchors ? target.getAnchors() : [];
	return anchors.map((a) => ({ x: a.x, y: a.y }));
}

export class ObjectAnchorsPatchHandler
	implements
		ActionHandler<
			ObjectAnchorsPatchAction,
			typeof objectAnchorsPatch._result,
			typeof objectAnchorsPatch._payload
		>
{
	execute(
		target: ISmartObject,
		_ctx: unknown,
		payload: { anchors: Array<{ x: number; y: number }>; before?: Array<{ x: number; y: number }> }
	): [ObjectAnchorsPatchAction | undefined, void] {
		const beforeAnchors = payload.before
			? JSON.parse(JSON.stringify(payload.before))
			: getAbsAnchors(target);

		const anyTarget = target;
		anyTarget.setAnchorsAbs!(payload.anchors);
		anyTarget.emit?.('update');

		return [
			{
				type: objectAnchorsPatch.type,
				targetId: target.id,
				before: { anchors: JSON.parse(JSON.stringify(beforeAnchors)) },
				after: { anchors: JSON.parse(JSON.stringify(payload.anchors)) }
			},
			undefined
		];
	}

	apply(action: ObjectAnchorsPatchAction, target: ISmartObject): void {
		const anyTarget = target as unknown as {
			setAnchorsAbs?: (anchors: Array<{ x: number; y: number }>) => void;
			emit?: (e: string) => void;
		};
		anyTarget.setAnchorsAbs!(action.after.anchors);
		anyTarget.emit?.('update');
	}

	revert(action: ObjectAnchorsPatchAction, target: ISmartObject): void {
		const anyTarget = target as unknown as {
			setAnchorsAbs?: (anchors: Array<{ x: number; y: number }>) => void;
			emit?: (e: string) => void;
		};
		anyTarget.setAnchorsAbs!(action.before.anchors);
		anyTarget.emit?.('update');
	}
}
