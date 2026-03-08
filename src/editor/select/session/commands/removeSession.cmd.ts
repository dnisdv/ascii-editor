import type { ISessionManagerCommand, ISessionManagerCommandDeps } from './type';
import { sessionRemove } from '@editor/select/history/session-remove';

export class RemoveSessionCommand implements ISessionManagerCommand {
	public execute(deps: ISessionManagerCommandDeps): void {
		deps.historyManager.execute(sessionRemove, 'select::session');
	}
}
