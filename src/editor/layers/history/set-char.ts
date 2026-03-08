import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { Layer } from '../layer';

export const setLayerChar = createActionDefinition<
	'layer::set_chars',
	{ x: number; y: number; char: string },
	void
>('layer::set_chars');

export interface SetCharAction extends BaseAction {
	type: typeof setLayerChar.type;
	before: { x: number; y: number; char: string };
	after: { x: number; y: number; char: string };
}

export class SetCharHandler
	implements ActionHandler<SetCharAction, typeof setLayerChar._result, typeof setLayerChar._payload>
{
	public execute(
		target: Layer,
		_context: unknown,
		payload: { x: number; y: number; char: string }
	): [SetCharAction, void] {
		const beforeChar = target.grid.getChar(payload.x, payload.y);

		target.grid.setChar(payload.x, payload.y, payload.char);

		const action: SetCharAction = {
			type: setLayerChar.type,
			targetId: target.id,
			before: { x: payload.x, y: payload.y, char: beforeChar },
			after: { x: payload.x, y: payload.y, char: payload.char }
		};

		return [action, undefined];
	}

	apply(action: SetCharAction, target: Layer): void {
		target.grid.setChar(action.after.x, action.after.y, action.after.char);
	}

	revert(action: SetCharAction, target: Layer): void {
		target.grid.setChar(action.before.x, action.before.y, action.before.char);
	}
}
