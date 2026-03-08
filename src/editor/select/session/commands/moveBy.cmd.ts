import type { LayersManager } from '@editor/layers/layers-manager';
import type { SelectionSession } from '../selection-session';
import type { ISessionCommand } from './type';
import type { HistoryManager } from '@editor/history-manager';
import { setVisualBatch, commitAllBatchFromVisual } from '@editor/objects/object-commands';
import type { ISmartObject } from '@editor/objects/smart-object.interface';

type MoveByDeps = {
	layersManager: LayersManager;
	historyManager: HistoryManager;
};

export class MoveByCommand implements ISessionCommand {
	constructor(
		private deps: MoveByDeps,
		private offset: { x: number; y: number },
		private options?: { recordHistory?: boolean; batchId?: string }
	) {}

	public execute(session: SelectionSession): void {
		const movableObjects = session.getSelectedObjects().filter((obj) => obj.capabilities.canMove);

		setVisualBatch(this.deps.historyManager, movableObjects, [
			{
				path: 'transform.x',
				value: (obj: ISmartObject) =>
					(obj.getProperty<number>('transform.x') as number) + this.offset.x
			},
			{
				path: 'transform.y',
				value: (obj: ISmartObject) =>
					(obj.getProperty<number>('transform.y') as number) + this.offset.y
			}
		]);
		if (this.options?.recordHistory !== false)
			commitAllBatchFromVisual(this.deps.historyManager, movableObjects);
		session.recalculateBoundingBox();
	}
}
