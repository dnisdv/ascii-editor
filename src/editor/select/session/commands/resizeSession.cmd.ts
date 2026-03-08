import type { HistoryManager } from '@editor/history-manager';
import type { SelectionSession } from '../selection-session';
import type { ISessionCommand } from './type';
import { commitAllBatchFromVisual, setVisual } from '@editor/objects/object-commands';

type ResizeByDeps = {
	historyManager: HistoryManager;
};

export class ResizeByCommand implements ISessionCommand {
	constructor(
		private deps: ResizeByDeps,
		private delta: { dx: number; dy: number; dw: number; dh: number },
		private options?: { recordHistory?: boolean }
	) {}

	public execute(session: SelectionSession): void {
		if (session.getSelectedObjects().length !== 1) return;
		const originalBoundingBox = session.boundingBox;
		if (!originalBoundingBox || originalBoundingBox.width === 0 || originalBoundingBox.height === 0)
			return;

		const obj = session.getSelectedObjects()[0];
		if (!obj) return;

		const x = obj.getProperty<number>('transform.x');
		const y = obj.getProperty<number>('transform.y');
		const width = obj.getProperty<number>('transform.width');
		const height = obj.getProperty<number>('transform.height');

		if (obj.capabilities.canMove) {
			const newX = x! + this.delta.dx;
			const newY = y! + this.delta.dy;
			setVisual(this.deps.historyManager, obj, 'transform.x', newX);
			setVisual(this.deps.historyManager, obj, 'transform.y', newY);
		}

		if (obj.capabilities.canResize) {
			const newWidth = width! + this.delta.dw;
			const newHeight = height! + this.delta.dh;
			setVisual(this.deps.historyManager, obj, 'transform.width', newWidth);
			setVisual(this.deps.historyManager, obj, 'transform.height', newHeight);
		}

		if (this.options?.recordHistory !== false)
			commitAllBatchFromVisual(this.deps.historyManager, [obj]);

		session.recalculateBoundingBox();
	}
}
