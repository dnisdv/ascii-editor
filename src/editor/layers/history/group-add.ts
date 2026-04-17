import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { LayersManager } from '../layers-manager';
import type { LayersExecutionContext } from './history-context';
import type { ILayerGroup } from '@editor/types/external/layer-group';

export const addGroup = createActionDefinition<
	'group::add',
	{ group: ILayerGroup },
	void
>('group::add');

export interface GroupAddAction extends BaseAction {
	type: typeof addGroup.type;
	before: null;
	after: { group: ILayerGroup };
}

export class GroupAdd
	implements ActionHandler<GroupAddAction, typeof addGroup._result, typeof addGroup._payload>
{
	public execute(
		_: LayersManager,
		context: LayersExecutionContext,
		payload: { group: ILayerGroup }
	): [GroupAddAction, void] {
		context.layersManager.getGroupManager().addGroup(payload.group);

		return [
			{
				type: addGroup.type,
				targetId: 'layers',
				before: null,
				after: { group: { ...payload.group } }
			},
			undefined
		];
	}

	apply(_action: GroupAddAction, _: LayersManager, context: LayersExecutionContext): void {
		context.layersManager.getGroupManager().addGroup({ ..._action.after.group });
	}

	revert(_action: GroupAddAction, _: LayersManager, context: LayersExecutionContext): void {
		context.layersManager.getGroupManager().removeGroup(_action.after.group.id);
	}
}
