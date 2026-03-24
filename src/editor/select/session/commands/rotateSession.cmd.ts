import type { SelectionSession } from '../selection-session';
import type { ISessionCommand } from './type';
import type { HistoryManager } from '@editor/history-manager';
import { isRotatable, type ISmartObject, type IRotatable, type RotationStep } from '@editor/objects/smart-object.interface';
import {
	objectRotationPatch,
	type ObjectRotationPatchAction,
	type RotationState
} from '@editor/objects/history/object-rotation-patch';

export class RotateByCommand implements ISessionCommand {
	constructor(
		private deps: { historyManager: HistoryManager },
		private angle: RotationStep
	) {}

	private captureState(obj: ISmartObject & IRotatable): RotationState {
		return {
			x: obj.getCommittedProperty<number>('transform.x'),
			y: obj.getCommittedProperty<number>('transform.y'),
			width: obj.getCommittedProperty<number>('transform.width'),
			height: obj.getCommittedProperty<number>('transform.height'),
			content: obj.getRotationContent?.()
		};
	}

	public execute(session: SelectionSession): void {
		const objects = session
			.getSelectedObjects()
			.filter((o): o is ISmartObject & IRotatable => o.capabilities.canRotate && isRotatable(o));
		if (!objects.length) return;

		for (const obj of objects) {
			const before = this.captureState(obj);

			obj.applyRotation(this.angle);

			const after = this.captureState(obj);

			const action: ObjectRotationPatchAction = {
				type: objectRotationPatch.type,
				targetId: obj.id,
				before,
				after
			};

			this.deps.historyManager.applyAction(action, { applyAction: false });
		}

		session.recalculateBoundingBox();
	}
}
