import type { ISessionManagerCommand, ISessionManagerCommandDeps } from './type';
import type { SelectionSessionManager } from '../selection-session-manager';

export class BringForwardCommand implements ISessionManagerCommand {
	public execute(deps: ISessionManagerCommandDeps, manager: SelectionSessionManager): void {
		const session = manager.getActiveSession();
		if (!session) return;

		const objects = session.getSelectedObjects();
		if (objects.length === 0) return;

		const layer = deps.layersManager.getActiveLayer();
		if (!layer) return;

		const sortedObjects = [...objects].sort((a, b) => {
			const idxA = layer.getIndexOfObject(a.id);
			const idxB = layer.getIndexOfObject(b.id);
			return idxA - idxB;
		});

		const selectedIds = new Set(objects.map((o) => o.id));

		const batchId = deps.historyManager.beginBatch({ type: 'layer::move_object' });

		for (const obj of sortedObjects) {
			const currentObjects = layer.getObjects();
			const currentIndex = layer.getIndexOfObject(obj.id);

			if (currentIndex > 0) {
				const objectAbove = currentObjects[currentIndex - 1];
				if (!selectedIds.has(objectAbove.id)) {
					deps.layersManager.moveLayerObject(layer.id, obj.id, currentIndex - 1, batchId);
				}
			}
		}

		deps.historyManager.commitBatch(batchId);
	}
}
