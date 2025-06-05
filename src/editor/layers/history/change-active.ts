import type { ActionHandler, BaseAction } from '@editor/history-manager';
import type { LayersManager } from '../layers-manager';

export interface LayerChangeActiveAction extends BaseAction {
	type: 'layers::change::active';
	before: { id: string };
	after: { id: string };
}

export class LayersChangeActive implements ActionHandler<LayerChangeActiveAction> {
	apply(action: LayerChangeActiveAction, target: LayersManager): void {
		target['layers'].setActiveLayer(action.after.id);
		target.emit('layers::active::change', { newId: action.after.id, oldId: action.before.id });
		target.getBus().emit('layer::change_active::response', { id: action.after.id });
	}

	revert(action: LayerChangeActiveAction, target: LayersManager): void {
		target['layers'].setActiveLayer(action.before.id);
		target.emit('layers::active::change', { oldId: action.after.id, newId: action.before.id });
		target.getBus().emit('layer::change_active::response', { id: action.before.id });
	}
}
