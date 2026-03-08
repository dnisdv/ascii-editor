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

export const sessionCommit = createActionDefinition<'select::session_commit', void, void>(
	'select::session_commit'
);

export interface SessionCommitAction extends BaseAction {
	type: typeof sessionCommit.type;
	before: {
		session: SessionSnapshot;
		gridSnapshot?: GridRegionSnapshot[];
	};
	after: { session: null };
}

export class SessionCommit
	implements
		ActionHandler<SessionCommitAction, typeof sessionCommit._result, typeof sessionCommit._payload>
{
	private captureOverwrittenContent(
		snapshot: SessionSnapshot,
		target: SelectionSessionManager
	): GridRegionSnapshot[] {
		const sourceLayer = target.getLayersManager().getLayer(snapshot._sourceLayerId || '');

		if (!sourceLayer) return [];

		const regions = (snapshot.selectedObjects ?? [])
			.filter((obj) => obj.type === 'text-selection')
			.map((serializedObj) => ({
				cellX: serializedObj.properties?.transform?.x?.value ?? 0,
				cellY: serializedObj.properties?.transform?.y?.value ?? 0,
				width: serializedObj.properties?.transform?.width?.value ?? 0,
				height: serializedObj.properties?.transform?.height?.value ?? 0
			}));

		return captureGridSnapshots(sourceLayer, regions);
	}

	execute(target: SelectionSessionManager): [SessionCommitAction | undefined, void | undefined] {
		const active = target.getActiveSession();
		if (!active) return [undefined, undefined];

		const snapshot = target.serializeActiveSession();
		if (!snapshot) return [undefined, undefined];

		const gridSnapshot = this.captureOverwrittenContent(snapshot, target);

		target.commitActiveSession();

		return [
			{
				type: sessionCommit.type,
				targetId: 'select::session',
				before: { session: snapshot, gridSnapshot },
				after: { session: null }
			},
			undefined
		];
	}

	apply(_: SessionCommitAction, target: SelectionSessionManager): void {
		const activeSession = target.getActiveSession();

		if (activeSession) {
			target.commitActiveSession();
		}
	}

	revert(action: SessionCommitAction, target: SelectionSessionManager): void {
		target.restoreSession(action.before.session);
		const gridSnapshots = action.before.gridSnapshot || [];
		restoreGridSnapshots(gridSnapshots, target.getLayersManager());
	}
}
