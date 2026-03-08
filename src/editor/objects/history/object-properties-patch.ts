import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { ISmartObject } from '@editor/objects/smart-object.interface';

export type PropertyChange = { path: string; before: unknown; after: unknown };

export const objectPropertiesPatch = createActionDefinition<
	'object::properties_patch',
	{ changes: PropertyChange[] },
	void
>('object::properties_patch');

export interface ObjectPropertiesPatchAction extends BaseAction {
	type: typeof objectPropertiesPatch.type;
	targetId: string;
	before: { changes: PropertyChange[] };
	after: { changes: PropertyChange[] };
}

export class ObjectPropertiesPatchHandler
	implements
		ActionHandler<
			ObjectPropertiesPatchAction,
			typeof objectPropertiesPatch._result,
			typeof objectPropertiesPatch._payload
		>
{
	execute(
		target: ISmartObject,
		_ctx: unknown,
		payload: { changes: PropertyChange[] }
	): [ObjectPropertiesPatchAction | undefined, void] {
		const changesCopy = JSON.parse(JSON.stringify(payload!.changes));

		const beforeChanges = changesCopy.map((c: PropertyChange) => {
			const prev = target.getCommittedProperty(c.path);
			return { path: c.path, before: prev, after: prev };
		});

		for (const c of changesCopy) {
			target.properties.applyCommitted(c.path, c.after);
		}
		target.emit?.('update');

		return [
			{
				type: objectPropertiesPatch.type,
				targetId: target.id,
				before: { changes: beforeChanges },
				after: {
					changes: JSON.parse(
						JSON.stringify(
							changesCopy.map((c: PropertyChange) => ({
								path: c.path,
								before: c.before,
								after: c.after
							}))
						)
					)
				}
			},
			undefined
		];
	}

	apply(action: ObjectPropertiesPatchAction, target: ISmartObject): void {
		for (const c of action.after.changes) target.properties.applyCommitted(c.path, c.after);
		target.emit?.('update');
	}

	revert(action: ObjectPropertiesPatchAction, target: ISmartObject): void {
		for (const c of action.before.changes) target.properties.applyCommitted(c.path, c.before);
		target.emit?.('update');
	}
}
