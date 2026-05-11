import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { ISmartObject } from '@editor/objects/smart-object.interface';

export const objectSetProperty = createActionDefinition<
	'object::set_property',
	{ path: string; value: unknown },
	void
>('object::set_property');

export interface SetPropertyAction extends BaseAction {
	type: typeof objectSetProperty.type;
	targetId: string;
	before: { path: string; value: unknown };
	after: { path: string; value: unknown };
}

export class SetPropertyHandler
	implements
		ActionHandler<
			SetPropertyAction,
			typeof objectSetProperty._result,
			typeof objectSetProperty._payload
		>
{
	public execute(
		target: ISmartObject,
		_context: unknown,
		payload: { path: string; value: unknown }
	): [SetPropertyAction | undefined, void] {
		const beforeValue = target.getCommittedProperty(payload.path);
		target.setProperty(payload.path, payload.value);

		const action: SetPropertyAction = {
			type: objectSetProperty.type,
			targetId: target.id,
			before: { path: payload.path, value: beforeValue },
			after: { path: payload.path, value: payload.value }
		};

		return [action, undefined];
	}

	apply(action: SetPropertyAction, target: ISmartObject): void {
		target.setProperty(action.after.path, action.after.value);
	}

	revert(action: SetPropertyAction, target: ISmartObject): void {
		target.setProperty(action.before.path, action.before.value);
	}
}
