import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { LayersManager } from '../layers-manager';
import type { LayersExecutionContext } from './history-context';
import type { ILayerGroup } from '@editor/types/external/layer-group';
import type { LayerGroupManager } from '../layer-group-manager';
import type { LayersListManager } from '../layer-list-manager';

type Snapshot = {
	layers: { id: string; index: number; groupId: string | null }[];
	groups: ILayerGroup[];
};

export interface UngroupPayload {
	id: string;
	removeChildren: boolean;
}

export const ungroupLayersAction = createActionDefinition<
	'layers::ungroup',
	UngroupPayload,
	void
>('layers::ungroup');

export interface UngroupLayersAction extends BaseAction {
	type: typeof ungroupLayersAction.type;
	before: Snapshot;
	after: Snapshot;
}

export class UngroupLayers
	implements
		ActionHandler<
			UngroupLayersAction,
			typeof ungroupLayersAction._result,
			typeof ungroupLayersAction._payload
		>
{
	execute(
		target: LayersManager,
		context: LayersExecutionContext,
		payload: UngroupPayload
	): [UngroupLayersAction, void] {
		const layersList = context.layersListManager;
		const groupManager = target.getGroupManager();

		const before = snapshot(layersList, groupManager);

		if (!groupManager.getGroup(payload.id)) {
			return [buildAction(before, before), undefined];
		}

		performUngroup(payload.id, payload.removeChildren, layersList, groupManager);
		const after = snapshot(layersList, groupManager);

		return [buildAction(before, after), undefined];
	}

	apply(action: UngroupLayersAction, target: LayersManager, context: LayersExecutionContext): void {
		restore(action.after, target, context);
	}

	revert(action: UngroupLayersAction, target: LayersManager, context: LayersExecutionContext): void {
		restore(action.before, target, context);
	}
}

function buildAction(before: Snapshot, after: Snapshot): UngroupLayersAction {
	return { type: ungroupLayersAction.type, targetId: 'layers', before, after };
}

function performUngroup(
	groupId: string,
	removeChildren: boolean,
	layersList: LayersListManager,
	groupManager: LayerGroupManager
): void {
	const group = groupManager.getGroup(groupId)!;

	const layers = layersList.getSortedLayers().filter((l) => l.groupId === groupId);
	for (const layer of layers) {
		layer.update({ groupId: group.parentId });
	}

	if (removeChildren) {
		for (const childId of groupManager.getChildGroupIds(groupId)) {
			const childLayers = layersList.getSortedLayers().filter((l) => l.groupId === childId);
			for (const cl of childLayers) {
				cl.update({ groupId: group.parentId });
			}
			groupManager.removeGroup(childId);
		}
	} else {
		for (const child of groupManager.getGroupsInParent(groupId)) {
			groupManager.updateGroup(child.id, { parentId: group.parentId });
		}
	}

	groupManager.removeGroup(groupId);
}

function snapshot(layersList: LayersListManager, groupManager: LayerGroupManager): Snapshot {
	return {
		layers: layersList.getSortedLayers().map((l) => ({
			id: l.id,
			index: l.index,
			groupId: l.groupId ?? null
		})),
		groups: groupManager.getGroups().map((g) => ({ ...g, opts: { ...g.opts } }))
	};
}

function restore(snap: Snapshot, target: LayersManager, context: LayersExecutionContext): void {
	const layersList = context.layersListManager;
	const groupManager = target.getGroupManager();

	const snapGroupIds = new Set(snap.groups.map((g) => g.id));
	const currentGroupIds = new Set(groupManager.getGroups().map((g) => g.id));

	for (const id of currentGroupIds) {
		if (!snapGroupIds.has(id)) groupManager.removeGroup(id);
	}

	for (const g of snap.groups) {
		if (!groupManager.hasGroup(g.id)) groupManager.addGroup({ ...g, opts: { ...g.opts } });
	}

	for (const g of snap.groups) {
		groupManager.updateGroup(g.id, {
			index: g.index,
			parentId: g.parentId,
			name: g.name,
			collapsed: g.collapsed,
			opts: { ...g.opts }
		});
	}

	for (const l of snap.layers) {
		layersList.getLayerById(l.id)?.update({ index: l.index, groupId: l.groupId });
	}
}
