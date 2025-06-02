import type { ActionHandler, BaseAction } from '@editor/history-manager';
import type { ILayer } from '@editor/types';

type Region = {
	region: {
		startX: number;
		startY: number;
		width: number;
		height: number;
	};
	data: string;
};

export interface SetRegionAction extends BaseAction {
	layerId: number;
	type: 'layer::set_region';
	before: Region;
	after: Region;
}

export class SetRegion implements ActionHandler<SetRegionAction> {
	apply(action: SetRegionAction, target: ILayer): void {
		const { region: afterRegion, data: afterData } = action.after;
		const { region: beforeRegion } = action.before;

		target.clearRegion(
			beforeRegion.startX,
			beforeRegion.startY,
			beforeRegion.width,
			beforeRegion.height
		);
		target.setToRegion(afterRegion.startX, afterRegion.startY, afterData);
	}

	revert(action: SetRegionAction, target: ILayer): void {
		const { region: afterRegion } = action.after;
		const { region: beforeRegion, data: beforeData } = action.before;

		target.clearRegion(
			afterRegion.startX,
			afterRegion.startY,
			afterRegion.width,
			afterRegion.height
		);
		target.setToRegion(beforeRegion.startX, beforeRegion.startY, beforeData);
	}
}
