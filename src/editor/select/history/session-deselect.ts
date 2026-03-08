import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { SessionSnapshot } from '../session/selection-session';
import type { SelectionSessionManager } from '../session/selection-session-manager';
import {
	captureGridSnapshots,
	restoreGridSnapshots,
	type GridRegionSnapshot
} from './history-shared';

export const sessionDeselect = createActionDefinition<
	'select::session_deselect',
	{
		deselectedObjectsIds: string[];
	},
	void
>('select::session_deselect');

export interface SessionDeselectAction extends BaseAction {
	type: typeof sessionDeselect.type;
	before: {
		session: SessionSnapshot;
		overwrittenContent?: GridRegionSnapshot[];
	};
	after: {
		session: SessionSnapshot;
		deselectedObjectsIds: string[];
	};
}

export class SessionDeselect
	implements
		ActionHandler<
			SessionDeselectAction,
			typeof sessionDeselect._result,
			typeof sessionDeselect._payload
		>
{
	private captureOverwrittenContent(
		objectIds: string[],
		target: SelectionSessionManager
	): GridRegionSnapshot[] {
		const session = target.getActiveSession();
		if (!session) return [];

		const sourceLayerId = session.getSourceLayerId();
		const sourceLayer = target.getLayersManager().getLayer(sourceLayerId || '');
		if (!sourceLayer) return [];

		const objects = objectIds
			.map((id) => session.getObjectById(id))
			.filter((obj) => obj && obj.type === 'text-selection');

		const regions = objects.map((obj) => ({
			cellX: Number(obj!.getProperty('transform.x')),
			cellY: Number(obj!.getProperty('transform.y')),
			width: Number(obj!.getProperty('transform.width')),
			height: Number(obj!.getProperty('transform.height'))
		}));

		return captureGridSnapshots(sourceLayer, regions);
	}

	private removeObjectsFromSourceLayer(target: SelectionSessionManager, objectIds: string[]): void {
		const session = target.getActiveSession();
		if (!session) return;

		const sourceLayerId = session.getSourceLayerId();
		const sourceLayer = target.getLayersManager().getLayer(sourceLayerId || '');
		if (!sourceLayer) return;

		objectIds.forEach((id) => {
			sourceLayer.removeObject(id);
		});
	}

	execute(
		target: SelectionSessionManager,
		_context: unknown,
		payload: typeof sessionDeselect._payload
	): [SessionDeselectAction | undefined, void | undefined] {
		const active = target.getActiveSession();
		if (!active) return [undefined, undefined];

		const snapshotBefore = target.serializeActiveSession();
		if (!snapshotBefore) return [undefined, undefined];

		if (!payload) return [undefined, undefined];

		const overwrittenContent = this.captureOverwrittenContent(payload.deselectedObjectsIds, target);

		active.commitObjects(payload.deselectedObjectsIds);

		const snapshotAfter = target.serializeActiveSession();
		if (!snapshotAfter) return [undefined, undefined];

		const shouldEndSession = (snapshotAfter.selectedObjects?.length ?? 0) === 0;
		if (shouldEndSession) {
			target.commitActiveSession();
		}

		return [
			{
				type: sessionDeselect.type,
				targetId: 'select::session',
				before: {
					session: snapshotBefore,
					overwrittenContent
				},
				after: {
					session: shouldEndSession ? (null as unknown as SessionSnapshot) : snapshotAfter,
					deselectedObjectsIds: payload.deselectedObjectsIds
				}
			},
			undefined
		];
	}

	apply(action: SessionDeselectAction, target: SelectionSessionManager): void {
		const activeSession = target.getActiveSession();
		if (activeSession) {
			activeSession.commitObjects(action.after.deselectedObjectsIds);

			if (!action.after.session) {
				target.commitActiveSession();
			}
		}
	}

	revert(action: SessionDeselectAction, target: SelectionSessionManager): void {
		target.restoreSession(action.before.session);
		this.removeObjectsFromSourceLayer(target, action.after.deselectedObjectsIds);

		const overwrittenContent = action.before.overwrittenContent || [];
		restoreGridSnapshots(overwrittenContent, target.getLayersManager());
	}
}
