import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { LayersManager, LayerMoveItem } from '../layers-manager';
import type { LayersExecutionContext } from './history-context';
import type { LayerGroupManager } from '../layer-group-manager';
import type { LayersListManager } from '../layer-list-manager';

type LayerSnapshot = { id: string; index: number; groupId: string | null };
type GroupSnapshot = { id: string; index: number; parentId: string | null };

type MoveSnapshot = {
	layers: LayerSnapshot[];
	groups: GroupSnapshot[];
};


export const moveLayers = createActionDefinition<'layers::move', LayerMoveItem[], void>(
	'layers::move'
);

export interface MoveLayersAction extends BaseAction {
	type: typeof moveLayers.type;
	before: MoveSnapshot;
	after: MoveSnapshot;
}

export class MoveLayers
	implements
		ActionHandler<MoveLayersAction, typeof moveLayers._result, typeof moveLayers._payload>
{
	execute(
		target: LayersManager,
		context: LayersExecutionContext,
		payload: LayerMoveItem[]
	): [MoveLayersAction, void] {
		const { layersListManager } = context;
		const gm = target.getGroupManager();

		const before = snapshot(layersListManager, gm);

		for (const item of payload) {
			if (item.kind === 'layer') {
				const layer = layersListManager.getLayerById(item.id);
				if (!layer) continue;
				layer.update({
					index: item.newIndex,
					...(item.newParentId !== undefined ? { groupId: item.newParentId } : {})
				});
			} else {
				gm.updateGroup(item.id, {
					index: item.newIndex,
					...(item.newParentId !== undefined ? { parentId: item.newParentId } : {})
				});
			}
		}

		const after = snapshot(layersListManager, gm);

		return [{ type: moveLayers.type, targetId: 'layers', before, after }, undefined];
	}

	apply(action: MoveLayersAction, target: LayersManager, context: LayersExecutionContext): void {
		restore(action.after, target, context);
	}

	revert(action: MoveLayersAction, target: LayersManager, context: LayersExecutionContext): void {
		restore(action.before, target, context);
	}
}


function snapshot(lm: LayersListManager, gm: LayerGroupManager): MoveSnapshot {
	return {
		layers: lm.getSortedLayers().map((l) => ({
			id: l.id,
			index: l.index,
			groupId: l.groupId ?? null
		})),
		groups: gm.getGroups().map((g) => ({
			id: g.id,
			index: g.index,
			parentId: g.parentId ?? null
		}))
	};
}

function restore(
	snap: MoveSnapshot,
	target: LayersManager,
	context: LayersExecutionContext
): void {
	const { layersListManager } = context;
	const gm = target.getGroupManager();

	for (const ls of snap.layers) {
		const layer = layersListManager.getLayerById(ls.id);
		if (layer) layer.update({ index: ls.index, groupId: ls.groupId });
	}
	for (const gs of snap.groups) {
		gm.updateGroup(gs.id, { index: gs.index, parentId: gs.parentId });
	}
}
