import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { LayersManager } from '../layers-manager';
import type { LayersExecutionContext } from './history-context';

export const changeActiveLayer = createActionDefinition<
	'layers::change::active',
	{ id: string | null },
	void
>('layers::change::active');

export interface LayerChangeActiveAction extends BaseAction {
	type: typeof changeActiveLayer.type;
	before: { id: string | null };
	after: { id: string | null };
}

export class LayersChangeActive
	implements
		ActionHandler<
			LayerChangeActiveAction,
			typeof changeActiveLayer._result,
			typeof changeActiveLayer._payload
		>
{
	public execute(
		_: LayersManager,
		context: LayersExecutionContext,
		payload: { id: string | null }
	): [LayerChangeActiveAction, void] {
		const beforeId = context.layersListManager.getActiveLayer()?.id || null;
		context.layersListManager.setActiveLayer(payload.id);

		return [
			{
				type: changeActiveLayer.type,
				targetId: 'layers',
				before: { id: beforeId },
				after: { id: payload.id }
			},
			undefined
		];
	}

	apply(action: LayerChangeActiveAction, target: LayersManager): void {
		target['layers'].setActiveLayer(action.after.id);
	}

	revert(action: LayerChangeActiveAction, target: LayersManager): void {
		target['layers'].setActiveLayer(action.before.id);
	}
}
