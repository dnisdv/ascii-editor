import type { SelectionSession } from '../selection-session';
import type { ISessionCommand } from './type';
import type { HistoryManager } from '@editor/history-manager';
import { sessionChange } from '@editor/select/history/session-change';

type RemoveObjectsDeps = {
	historyManager: HistoryManager;
};

type RemoveObjectsPayload = {
	objectsIds: string[];
};

export class RemoveObjectsCommand implements ISessionCommand {
	constructor(
		private deps: RemoveObjectsDeps,
		private payload: RemoveObjectsPayload
	) {}

	public execute(session: SelectionSession): void {
		const sessionBefore = session.serialize();
		session.removeObjects(this.payload.objectsIds);
		const sessionAfter = session.serialize();

		this.deps.historyManager.execute(sessionChange, 'select::session', {
			before: sessionBefore,
			after: sessionAfter
		});
	}
}
