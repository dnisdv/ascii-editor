import type { ActionHandler, BaseAction } from '@editor/history-manager';
import type { SingleSessionSnapshot } from '../session/selection-session';
import type { SelectionSessionManager } from '../session/selection-session-manager';

export interface SelectSessionCancelAction extends BaseAction {
	type: 'select::session_cancel';
	before: {
		session: SingleSessionSnapshot;
	};
	after: {
		session: null;
	};
}

export class SelectSessionCancel implements ActionHandler<SelectSessionCancelAction> {
	apply(action: SelectSessionCancelAction, target: SelectionSessionManager): void {
		const sessionToCancel = target.getActiveSession();
		if (sessionToCancel && sessionToCancel.id === action.before.session.id) {
			target.cancelActiveSession();
		}
	}

	revert(action: SelectSessionCancelAction, target: SelectionSessionManager): void {
		target.restoreSession(action.before.session);

		const sourceLayerId = action.before.session.sourceLayerId;
		const selectedContent = action.before.session.selectedContent;

		if (sourceLayerId && selectedContent) {
			const activeLayer = target.getLayersManager().getLayer(sourceLayerId);
			if (activeLayer) {
				activeLayer.clearRegion(
					selectedContent.region.startX,
					selectedContent.region.startY,
					selectedContent.region.width,
					selectedContent.region.height
				);
			}
		}
	}
}
