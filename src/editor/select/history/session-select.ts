import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { SessionSnapshot } from '../session/selection-session';
import type { SelectionSessionManager } from '../session/selection-session-manager';
import type { ISmartObject } from '@editor/objects/smart-object.interface';
import {
	clearObjects,
	removeObjectsById,
	restoreSmartObjects,
	restoreTextGridObjects
} from './history-shared';

export const sessionSelect = createActionDefinition<
	'select::session_select',
	{ objects: ISmartObject[] | null; restore: boolean; clearRegion?: boolean } | null,
	void
>('select::session_select');

export interface SessionSelectAction extends BaseAction {
	type: typeof sessionSelect.type;
	before: { session: SessionSnapshot | null; restore?: boolean };
	after: { session: SessionSnapshot | null; clearRegion?: boolean };
}

export class SessionSelect
	implements
		ActionHandler<SessionSelectAction, typeof sessionSelect._result, typeof sessionSelect._payload>
{
	execute(
		target: SelectionSessionManager,
		_context: unknown,
		payload: typeof sessionSelect._payload
	): [SessionSelectAction | undefined, void | undefined] {
		const beforeSession = target.serializeActiveSession() || null;
		const activeSession = target.getActiveSession();
		if (activeSession) {
			target.commitActiveSession();
		}

		if (!payload?.objects || payload.objects.length === 0) return [undefined, undefined];

		const sourceLayerId = target.getLayersManager().getActiveLayerKey();
		if (!sourceLayerId) return [undefined, undefined];

		const newActiveSession = target.createSession(sourceLayerId);
		target.setActiveSession(newActiveSession);

		newActiveSession.addObjects(payload.objects, { clearRegion: payload.clearRegion });
		const afterSession = target.serializeActiveSession() || null;

		const action: SessionSelectAction = {
			type: sessionSelect.type,
			targetId: 'select::session',
			before: { session: beforeSession, restore: payload?.restore },
			after: { session: afterSession, clearRegion: payload?.clearRegion }
		};

		return [action, undefined];
	}

	apply(action: SessionSelectAction, target: SelectionSessionManager): void {
		const sourceLayer = target
			.getLayersManager()!
			.getLayer(action.after.session?._sourceLayerId || '');
		if (!sourceLayer) return;

		if (action.after.clearRegion !== false) {
			clearObjects(sourceLayer, action.after.session?.selectedObjects || []);
		}
		target.restoreSession(action.after.session ?? null);
	}

	revert(action: SessionSelectAction, target: SelectionSessionManager): void {
		const sourceLayer = target
			.getLayersManager()!
			.getLayer(action.after.session?._sourceLayerId || '');
		if (!sourceLayer) return;

		target.restoreSession(action.before.session ?? null);

		if (action.before.restore) {
			restoreTextGridObjects(sourceLayer, action.after.session?.selectedObjects || []);
			restoreSmartObjects(
				sourceLayer,
				action.after.session?.selectedObjects || [],
				target.getSmartObjectsManager(),
				action.after.session?.orderKeys
			);

			return;
		}

		const objectsToRemove = action.after.session?.selectedObjects || [];
		removeObjectsById(
			sourceLayer,
			objectsToRemove.map((obj) => obj.id)
		);
	}
}
