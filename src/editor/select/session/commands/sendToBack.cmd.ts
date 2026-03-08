import type { ISessionManagerCommand, ISessionManagerCommandDeps } from './type';
import type { SelectionSessionManager } from '../selection-session-manager';

export class SendToBackCommand implements ISessionManagerCommand {
	public execute(deps: ISessionManagerCommandDeps, manager: SelectionSessionManager): void {
		const session = manager.getActiveSession();
		if (!session) return;

		const objects = session.getSelectedObjects();
		if (objects.length === 0) return;

		const layer = deps.layersManager.getActiveLayer();
		if (!layer) return;

		const allObjects = layer.getObjects();

		const sortedObjects = [...objects].sort((a, b) => {
			const idxA = layer.getIndexOfObject(a.id);
			const idxB = layer.getIndexOfObject(b.id);
			return idxB - idxA;
		});

		const batchId = deps.historyManager.beginBatch({ type: 'layer::move_object' });

		for (const obj of sortedObjects) {
			deps.layersManager.moveLayerObject(layer.id, obj.id, allObjects.length - 1, batchId);
		}

		deps.historyManager.commitBatch(batchId);
	}
}
