import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { SessionSnapshot } from '../session/selection-session';
import type { SelectionSessionManager } from '../session/selection-session-manager';
import type { ISmartObject } from '@editor/objects/smart-object.interface';
import type { SmartObjectSerializableSchemaType } from '@editor/serializer/smart-object.schema';
import { clearObjects, restoreSmartObjects, restoreTextGridObjects } from './history-shared';

export const sessionAppendRegion = createActionDefinition<
	'select::session_append_region',
	{ objects: ISmartObject[] } | null,
	void
>('select::session_append_region');

export interface SessionAppendRegionAction extends BaseAction {
	type: typeof sessionAppendRegion.type;
	before: {
		session: SessionSnapshot | null;
		appendedObjects?: SmartObjectSerializableSchemaType[];
	};
	after: { session: SessionSnapshot | null };
}

export class SessionAppendRegion
	implements
		ActionHandler<
			SessionAppendRegionAction,
			typeof sessionAppendRegion._result,
			typeof sessionAppendRegion._payload
		>
{
	execute(
		target: SelectionSessionManager,
		_context: unknown,
		payload: typeof sessionAppendRegion._payload
	): [SessionAppendRegionAction | undefined, void | undefined] {
		if (!payload || !payload.objects || payload.objects.length === 0) return [undefined, undefined];

		const session = target.getActiveSession();
		if (!session) return [undefined, undefined];

		const before = target.serializeActiveSession();
		if (!before) return [undefined, undefined];

		const appendedObjects: SmartObjectSerializableSchemaType[] = payload.objects.map((obj) =>
			obj.serialize()
		);

		session.addObjects(payload.objects);

		const after = target.serializeActiveSession();
		if (!after) return [undefined, undefined];

		return [
			{
				type: sessionAppendRegion.type,
				targetId: 'select::session',
				before: { session: before, appendedObjects },
				after: { session: after }
			},
			undefined
		];
	}

	apply(action: SessionAppendRegionAction, target: SelectionSessionManager): void {
		const sourceLayer = target
			.getLayersManager()!
			.getLayer(action.after.session?._sourceLayerId || '');
		if (!sourceLayer) return;

		const appended = action.before.appendedObjects || [];
		clearObjects(sourceLayer, appended);
		target.restoreSession(action.after.session);
	}

	revert(action: SessionAppendRegionAction, target: SelectionSessionManager): void {
		const sourceLayer = target
			.getLayersManager()!
			.getLayer(action.after.session?._sourceLayerId || '');
		if (!sourceLayer) return;

		target.restoreSession(action.before.session);

		const appended = action.before.appendedObjects || [];
		restoreTextGridObjects(sourceLayer, appended);

		restoreSmartObjects(
			sourceLayer,
			appended || [],
			target.getSmartObjectsManager(),
			action.after.session?.orderKeys
		);
	}
}
