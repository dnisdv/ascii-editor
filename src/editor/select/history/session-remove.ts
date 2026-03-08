import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { SessionSnapshot } from '../session/selection-session';
import type { SelectionSessionManager } from '../session/selection-session-manager';
import { restoreSmartObjects } from './history-shared';
import type { SmartObjectSerializableSchemaType } from '@editor/serializer/smart-object.schema';

export const sessionRemove = createActionDefinition<'select::session_remove', void, void>(
	'select::session_remove'
);

export interface SessionRemoveAction extends BaseAction {
	type: typeof sessionRemove.type;
	before: { session: SessionSnapshot };
	after: { session: null; deletedObjects: SmartObjectSerializableSchemaType[] };
}

export class SessionRemove
	implements
		ActionHandler<SessionRemoveAction, typeof sessionRemove._result, typeof sessionRemove._payload>
{
	execute(target: SelectionSessionManager): [SessionRemoveAction | undefined, void | undefined] {
		const active = target.getActiveSession();
		if (!active) return [undefined, undefined];

		const snapshot = target.serializeActiveSession();
		if (!snapshot) return [undefined, undefined];
		const deletedObjects = active.getSelectedObjects().map((obj) => obj.serialize());

		target.deleteActiveSession();

		return [
			{
				type: sessionRemove.type,
				targetId: 'select::session',
				before: { session: snapshot },
				after: { session: null, deletedObjects }
			},
			undefined
		];
	}

	apply(_: SessionRemoveAction, target: SelectionSessionManager): void {
		const active = target.getActiveSession();
		if (active) target.deleteActiveSession();
	}

	revert(action: SessionRemoveAction, target: SelectionSessionManager): void {
		const sourceLayer = target
			.getLayersManager()!
			.getLayer(action.before.session._sourceLayerId || '');
		if (!sourceLayer) return;

		const orderKeys = action.before.session.orderKeys || {};

		restoreSmartObjects(
			sourceLayer,
			action.after.deletedObjects,
			target.getSmartObjectsManager(),
			orderKeys
		);
		target.restoreSession(action.before.session);
	}
}
