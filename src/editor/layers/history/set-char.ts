import type { ActionHandler, BaseAction } from '@editor/history-manager';
import type { ILayer } from '@editor/types';

export interface SetCharAction extends BaseAction {
	layerId: number;
	type: 'layer::set_chars';
	before: { x: number; y: number; char: string };
	after: { x: number; y: number; char: string };
}

export class SetCharHandler implements ActionHandler<SetCharAction> {
	apply(action: SetCharAction, target: ILayer): void {
		target.setChar(action.after.x, action.after.y, action.after.char);
	}

	revert(action: SetCharAction, target: ILayer): void {
		target.setChar(action.before.x, action.before.y, action.before.char);
	}
}
