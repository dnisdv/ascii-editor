import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { LayersManager } from '../layers-manager';
import type { LayersExecutionContext } from './history-context';
import type { ILayerGroup } from '@editor/types/external/layer-group';

export const removeGroup = createActionDefinition<
	'group::remove',
	{ id: string },
	void
>('group::remove');

export interface GroupRemoveAction extends BaseAction {
	type: typeof removeGroup.type;
	before: { group: ILayerGroup };
	after: null;
}

export class GroupRemove
	implements ActionHandler<GroupRemoveAction, typeof removeGroup._result, typeof removeGroup._payload>
{
	public execute(
		_: LayersManager,
		context: LayersExecutionContext,
		payload: { id: string }
	): [GroupRemoveAction, void] {
		const group = context.layersManager.getGroupManager().getGroup(payload.id);
		if (!group) {
			throw new Error(`Cannot remove group: Group with ID "${payload.id}" not found.`);
		}

		const snapshot = { ...group, opts: { ...group.opts } };
		context.layersManager.getGroupManager().removeGroup(payload.id);

		return [
			{
				type: removeGroup.type,
				targetId: 'layers',
				before: { group: snapshot },
				after: null
			},
			undefined
		];
	}

	apply(_action: GroupRemoveAction, _: LayersManager, context: LayersExecutionContext): void {
		context.layersManager.getGroupManager().removeGroup(_action.before.group.id);
	}

	revert(_action: GroupRemoveAction, _: LayersManager, context: LayersExecutionContext): void {
		context.layersManager.getGroupManager().addGroup({ ..._action.before.group });
	}
}
