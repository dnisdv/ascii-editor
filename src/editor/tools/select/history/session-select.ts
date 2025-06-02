import type { ActionHandler, BaseAction } from '@editor/history-manager';
import type { SingleSessionSnapshot } from '../session/selection-session';
import type { SelectionSessionManager } from '../session/selection-session-manager';

export interface SelectSessionAction extends BaseAction {
	type: 'select::session_select';
	before: {
		session: null;
		data: string;
	};
	after: {
		session: SingleSessionSnapshot;
		data: string;
	};
}

export class SelectSession implements ActionHandler<SelectSessionAction> {
	apply(action: SelectSessionAction, target: SelectionSessionManager): void {
		const session = target.restoreSession(action.after.session);
		const sourceLayerId = action.after.session.sourceLayerId;
		const selectedContent = action.after.session.selectedContent;

		if (sourceLayerId && selectedContent) {
			const activeLayer = session?.getSourceLayer();

			if (activeLayer) {
				activeLayer.clearRegion(
					selectedContent.region.startX,
					selectedContent.region.startY,
					selectedContent.region.width,
					selectedContent.region.height
				);
				activeLayer.setToRegion(
					selectedContent.region.startX,
					selectedContent.region.startY,
					action.before.data,
					{ skipSpaces: false }
				);
			}
		}
	}

	revert(action: SelectSessionAction, target: SelectionSessionManager): void {
		target.commitActiveSession();

		const sourceLayerId = action.after.session.sourceLayerId;
		const originalContentLocation = action.after.session.selectedContent?.region;

		if (sourceLayerId && originalContentLocation) {
			const activeLayer = target.getLayersManager().getLayer(sourceLayerId);
			if (activeLayer) {
				activeLayer.setToRegion(
					originalContentLocation.startX,
					originalContentLocation.startY,
					action.before.data,
					{ skipSpaces: false }
				);
			}
		}
	}
}
