import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { SessionSnapshot } from '../session/selection-session';
import type { SelectionSessionManager } from '../session/selection-session-manager';
import type { ISmartObject } from '@editor/objects/smart-object.interface';
import { restoreSmartObjects, removeObjectsById } from './history-shared';
import type { SmartObjectSerializableSchemaType } from '@editor/serializer/smart-object.schema';

export const sessionAppendObjects = createActionDefinition<
	'select::session_append_objects',
	{ objects: ISmartObject[] },
	void
>('select::session_append_objects');

export interface SessionAppendObjectsAction extends BaseAction {
	type: typeof sessionAppendObjects.type;
	before: {
		session: SessionSnapshot;
		sourceObjects: SmartObjectSerializableSchemaType[];
		orderKeys: Record<string, string>;
	};
	after: {
		session: SessionSnapshot;
		addedObjectsIds: string[];
	};
}

export class SessionAppendObjects
	implements
		ActionHandler<
			SessionAppendObjectsAction,
			typeof sessionAppendObjects._result,
			typeof sessionAppendObjects._payload
		>
{
	private captureSourceObjects(
		target: SelectionSessionManager,
		objectIds: string[]
	): { objects: SmartObjectSerializableSchemaType[]; orderKeys: Record<string, string> } {
		const session = target.getActiveSession();
		if (!session) return { objects: [], orderKeys: {} };
		const sourceLayerId = session.getSourceLayerId();
		const sourceLayer = target.getLayersManager().getLayer(sourceLayerId || '');
		if (!sourceLayer) return { objects: [], orderKeys: {} };

		const objects: SmartObjectSerializableSchemaType[] = [];
		const orderKeys: Record<string, string> = {};

		objectIds.forEach((id) => {
			const obj = sourceLayer.getObjectById(id);
			if (obj) {
				objects.push(obj.serialize());
				const key = sourceLayer.getOrderKey(id);
				if (key) orderKeys[id] = key;
			}
		});

		return { objects, orderKeys };
	}

	private removeObjectsFromSource(target: SelectionSessionManager, objectIds: string[]): void {
		const session = target.getActiveSession();
		if (!session) return;
		const sourceLayerId = session.getSourceLayerId();
		const sourceLayer = target.getLayersManager().getLayer(sourceLayerId || '');
		if (!sourceLayer) return;

		removeObjectsById(sourceLayer, objectIds);
	}

	execute(
		target: SelectionSessionManager,
		_context: unknown,
		payload: typeof sessionAppendObjects._payload
	): [SessionAppendObjectsAction | undefined, void | undefined] {
		const active = target.getActiveSession();
		if (!active) return [undefined, undefined];

		const snapshotBefore = target.serializeActiveSession();
		if (!snapshotBefore) return [undefined, undefined];

		if (!payload || payload.objects.length === 0) return [undefined, undefined];

		const { objects: sourceObjects, orderKeys } = this.captureSourceObjects(
			target,
			payload.objects.map((o) => o.id)
		);

		active.addObjects(payload.objects);
		this.removeObjectsFromSource(
			target,
			payload.objects.map((o) => o.id)
		);

		const snapshotAfter = target.serializeActiveSession();
		if (!snapshotAfter) return [undefined, undefined];

		return [
			{
				type: sessionAppendObjects.type,
				targetId: 'select::session',
				before: {
					session: snapshotBefore,
					sourceObjects,
					orderKeys
				},
				after: {
					session: snapshotAfter,
					addedObjectsIds: payload.objects.map((o) => o.id)
				}
			},
			undefined
		];
	}

	apply(action: SessionAppendObjectsAction, target: SelectionSessionManager): void {
		target.restoreSession(action.after.session);
		this.removeObjectsFromSource(target, action.after.addedObjectsIds);
	}

	revert(action: SessionAppendObjectsAction, target: SelectionSessionManager): void {
		target.restoreSession(action.before.session);

		const session = target.getActiveSession();
		if (!session) return;

		const sourceLayerId = session.getSourceLayerId();
		const sourceLayer = target.getLayersManager().getLayer(sourceLayerId || '');
		if (!sourceLayer) return;

		restoreSmartObjects(
			sourceLayer,
			action.before.sourceObjects,
			target.getSmartObjectsManager(),
			action.before.orderKeys
		);
	}
}
