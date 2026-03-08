import type { ISessionManagerCommand, ISessionManagerCommandDeps } from './type';
import type { SelectionSessionManager } from '../selection-session-manager';
import { sessionCommit } from '@editor/select/history/session-commit';

export class CommitSessionCommand implements ISessionManagerCommand {
	public execute(deps: ISessionManagerCommandDeps, _: SelectionSessionManager): void {
		void _;
		deps.historyManager.execute(sessionCommit, 'select::session');
	}
}
