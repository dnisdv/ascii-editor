import type { ActionHandler, BaseAction } from '@editor/history-manager';
import type { ILayersManager } from '@editor/types';

export interface LayerChangeActiveAction extends BaseAction {
	type: 'layers::change::active';
	before: { id: string };
	after: { id: string };
}

export class LayersChangeActive implements ActionHandler<LayerChangeActiveAction> {
	apply(action: LayerChangeActiveAction, target: ILayersManager): void {
		target.silentActivateLayer(action.after.id);
	}

	revert(action: LayerChangeActiveAction, target: ILayersManager): void {
		target.silentActivateLayer(action.before.id);
	}
}
