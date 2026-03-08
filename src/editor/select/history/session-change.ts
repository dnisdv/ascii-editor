import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { SessionSnapshot } from '../session/selection-session';
import { type SelectionSessionManager } from '../session/selection-session-manager';

export const sessionChange = createActionDefinition<
	'select::session_change',
	{ before: SessionSnapshot; after: SessionSnapshot },
	void
>('select::session_change');

export interface SessionChangeAction extends BaseAction {
	type: typeof sessionChange.type;
	before: { session: SessionSnapshot | null };
	after: { session: SessionSnapshot | null };
}

export class SessionChange
	implements
		ActionHandler<SessionChangeAction, typeof sessionChange._result, typeof sessionChange._payload>
{
	execute(
		_target: SelectionSessionManager,
		_context: unknown,
		payload: typeof sessionChange._payload
	): [SessionChangeAction | undefined, void | undefined] {
		return [
			{
				type: sessionChange.type,
				targetId: 'select::session',
				before: { session: payload!.before },
				after: { session: payload!.after }
			},
			undefined
		];
	}

	apply(action: SessionChangeAction, target: SelectionSessionManager): void {
		target.restoreSession(action.after.session);
	}

	revert(action: SessionChangeAction, target: SelectionSessionManager): void {
		target.restoreSession(action.before.session);
	}
}
