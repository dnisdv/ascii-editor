import type { ISessionManagerCommand, ISessionManagerCommandDeps } from './type';
import type { ISmartObject } from '@editor/objects/smart-object.interface';
import type { HistoryManager } from '@editor/history-manager';
import type { SelectionSessionManager } from '../selection-session-manager';
import { sessionSelect } from '@editor/select/history/session-select';
import { sessionAppendObjects } from '@editor/select/history/session-append-objects';

type AppendObjectsDeps = {
	historyManager: HistoryManager;
};

type AppendObjectsPayload = {
	objects: ISmartObject[];
};

export class AppendObjectsCommand implements ISessionManagerCommand {
	constructor(
		private deps: AppendObjectsDeps,
		private payload: AppendObjectsPayload
	) {}

	public execute(deps: ISessionManagerCommandDeps, manager: SelectionSessionManager): void {
		const activeLayerId = deps.layersManager.getActiveLayerKey();
		if (!activeLayerId) return;

		const session = manager.getActiveSession();

		if (!session) {
			this.deps.historyManager.execute(sessionSelect, 'select::session', {
				objects: this.payload.objects,
				restore: true
			});
			return;
		}

		const objectsToAdd = this.payload.objects.filter((obj) => !session.hasObject(obj.id));
		if (objectsToAdd.length === 0) return;

		this.deps.historyManager.execute(sessionAppendObjects, 'select::session', {
			objects: objectsToAdd
		});
	}
}
