import type { ISessionManagerCommand, ISessionManagerCommandDeps } from './type';
import type { ISmartObject } from '@editor/objects/smart-object.interface';
import { sessionSelect } from '@editor/select/history/session-select';
import type { SelectionSessionManager } from '../selection-session-manager';
import { CommitSessionCommand } from './commitSession.cmd';

export class SelectObjectsCommand implements ISessionManagerCommand {
	constructor(
		private objects: ISmartObject[],
		private options?: { clearRegion?: boolean }
	) {}

	public execute(deps: ISessionManagerCommandDeps, manager: SelectionSessionManager): void {
		const activeSession = manager.getActiveSession();
		if (activeSession) {
			const allAlreadySelected = this.objects.every((obj) => activeSession.hasObject(obj.id));
			if (allAlreadySelected && this.objects.length === activeSession.getSelectedObjects().length) {
				return;
			}

			const commitCommand = new CommitSessionCommand();
			commitCommand.execute(deps, manager);
		}

		if (this.objects.length === 0) return;

		const activeLayer = deps.layersManager.getActiveLayer();
		let restore = false;
		if (activeLayer) {
			const layerObjects = activeLayer.getObjects();
			const layerObjectIds = new Set(layerObjects.map((o) => o.id));
			restore = this.objects.every((obj) => layerObjectIds.has(obj.id));
		}

		deps.historyManager.execute(sessionSelect, 'select::session', {
			objects: this.objects,
			restore,
			clearRegion: this.options?.clearRegion
		});
	}
}
