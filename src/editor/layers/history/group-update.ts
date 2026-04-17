import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { LayersManager } from '../layers-manager';
import type { LayersExecutionContext } from './history-context';
import type { ILayerGroup } from '@editor/types/external/layer-group';
import type { DeepPartial } from '@editor/types';

export const updateGroup = createActionDefinition<
	'group::update',
	{ id: string; changes: DeepPartial<ILayerGroup> },
	void
>('group::update');

export interface GroupUpdateAction extends BaseAction {
	type: typeof updateGroup.type;
	before: ILayerGroup;
	after: ILayerGroup;
}

export class GroupUpdate
	implements ActionHandler<GroupUpdateAction, typeof updateGroup._result, typeof updateGroup._payload>
{
	public execute(
		_: LayersManager,
		context: LayersExecutionContext,
		payload: { id: string; changes: DeepPartial<ILayerGroup> }
	): [GroupUpdateAction, void] {
		const gm = context.layersManager.getGroupManager();
		const group = gm.getGroup(payload.id);
		if (!group) {
			throw new Error(`Cannot update group: Group with ID "${payload.id}" not found.`);
		}

		const before: ILayerGroup = { ...group, opts: { ...group.opts } };
		gm.updateGroup(payload.id, payload.changes);
		const after: ILayerGroup = { ...gm.getGroup(payload.id)!, opts: { ...gm.getGroup(payload.id)!.opts } };

		return [
			{
				type: updateGroup.type,
				targetId: 'layers',
				before,
				after
			},
			undefined
		];
	}

	apply(action: GroupUpdateAction, _: LayersManager, context: LayersExecutionContext): void {
		context.layersManager.getGroupManager().updateGroup(action.after.id, action.after);
	}

	revert(action: GroupUpdateAction, _: LayersManager, context: LayersExecutionContext): void {
		context.layersManager.getGroupManager().updateGroup(action.before.id, action.before);
	}
}
