import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { Layer } from '@editor/layers/layer';

export const objectPropertiesCommit = createActionDefinition<
	'object::properties_commit',
	{ objectId: string; changes: { path: string; before: unknown; after: unknown }[] },
	void
>('object::properties_commit');

export interface ObjectPropertiesCommitAction extends BaseAction {
	type: typeof objectPropertiesCommit.type;
	targetId: string;
	objectId: string;
	before: { changes: { path: string; before: unknown; after: unknown }[] };
	after: { changes: { path: string; before: unknown; after: unknown }[] };
}

export class ObjectPropertiesCommitHandler
	implements
		ActionHandler<
			ObjectPropertiesCommitAction,
			typeof objectPropertiesCommit._result,
			typeof objectPropertiesCommit._payload
		>
{
	execute(): [ObjectPropertiesCommitAction | undefined, void] {
		return [undefined, undefined];
	}

	apply(action: ObjectPropertiesCommitAction, target: Layer): void {
		const layer = target;
		const obj = layer.getObjectById(action.objectId);
		if (!obj) return;
		for (const c of action.after.changes) {
			obj.setProperty(c.path, c.after);
		}
	}

	revert(action: ObjectPropertiesCommitAction, target: Layer): void {
		const layer = target;
		const obj = layer.getObjectById(action.objectId);
		if (!obj) return;
		for (const c of action.before.changes) {
			obj.setProperty(c.path, c.before);
		}
	}
}
