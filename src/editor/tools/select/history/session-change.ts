import type { ActionHandler, BaseAction } from '@editor/history-manager';
import type { SingleSessionSnapshot } from '../session/selection-session';
import type { SelectionSessionManager } from '../session/selection-session-manager';

export interface SelectSessionChangeAction extends BaseAction {
	type: 'select::session_change';
	before: SingleSessionSnapshot | null;
	after: SingleSessionSnapshot | null;
}

export class SelectSessionChange implements ActionHandler<SelectSessionChangeAction> {
	apply(action: SelectSessionChangeAction, target: SelectionSessionManager): void {
		target.restoreSession(action.after);
	}

	revert(action: SelectSessionChangeAction, target: SelectionSessionManager): void {
		target.restoreSession(action.before);
	}
}
