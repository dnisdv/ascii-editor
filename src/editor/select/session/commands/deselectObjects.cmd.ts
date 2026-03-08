import type { ISessionCommand } from './type';
import type { HistoryManager } from '@editor/history-manager';
import { sessionDeselect } from '@editor/select/history/session-deselect';

type DeselectObjectsDeps = {
	historyManager: HistoryManager;
};

type DeselectObjectsPayload = {
	objectsIds: string[];
};

export class DeselectObjectsCommand implements ISessionCommand {
	constructor(
		private deps: DeselectObjectsDeps,
		private payload: DeselectObjectsPayload
	) {}

	public execute(): void {
		this.deps.historyManager.execute(sessionDeselect, 'select::session', {
			deselectedObjectsIds: this.payload.objectsIds
		});
	}
}
