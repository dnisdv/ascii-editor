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
import type { Layer } from '../layer';

type Snapshot = {
	layers: { id: string; index: number; groupId: string | null }[];
	groups: ILayerGroup[];
};

export interface GroupLayersPayload {
	layerIds: string[];
	groupName: string;
	group: ILayerGroup;
}

export const groupLayersAction = createActionDefinition<
	'layers::group',
	GroupLayersPayload,
	ILayerGroup | null
>('layers::group');

export interface GroupLayersAction extends BaseAction {
	type: typeof groupLayersAction.type;
	before: Snapshot;
	after: Snapshot;
	group: ILayerGroup;
}

export class GroupLayers
	implements
		ActionHandler<
			GroupLayersAction,
			typeof groupLayersAction._result,
			typeof groupLayersAction._payload
		>
{
	execute(
		target: LayersManager,
		context: LayersExecutionContext,
		payload: GroupLayersPayload
	): [GroupLayersAction, ILayerGroup | null] {
		const layersList = context.layersListManager;
		const groupManager = target.getGroupManager();

		const resolvedLayers = payload.layerIds
			.map((id) => layersList.getLayerById(id))
			.filter((l): l is Layer => !!l);

		if (resolvedLayers.length === 0) {
			const snap = snapshot(layersList, groupManager);
			return [
				buildAction(snap, snap, payload.group),
				null
			];
		}

		const before = snapshot(layersList, groupManager);
		performGrouping(resolvedLayers, payload.group, layersList, groupManager);
		const after = snapshot(layersList, groupManager);

		return [buildAction(before, after, { ...payload.group }), payload.group];
	}

	apply(action: GroupLayersAction, target: LayersManager, context: LayersExecutionContext): void {
		restore(action.after, target, context);
	}

	revert(action: GroupLayersAction, target: LayersManager, context: LayersExecutionContext): void {
		restore(action.before, target, context);
	}
}


function buildAction(before: Snapshot, after: Snapshot, group: ILayerGroup): GroupLayersAction {
	return { type: groupLayersAction.type, targetId: 'layers', before, after, group };
}

function performGrouping(
	layers: Layer[],
	group: ILayerGroup,
	layersList: LayersListManager,
	groupManager: LayerGroupManager
): void {
	const parentGroupId = layers[0].groupId ?? null;
	group.index = Math.min(...layers.map((l) => l.index));

	groupManager.addGroup(group);

	for (const layer of layers) {
		layer.update({ groupId: group.id });
	}

	compactScopeIndices(parentGroupId, group.id, layersList, groupManager);
}

function compactScopeIndices(
	scopeId: string | null,
	newGroupId: string,
	layersList: LayersListManager,
	groupManager: LayerGroupManager
): void {
	const scopeLayers = layersList.getSortedLayers().filter((l) => (l.groupId ?? null) === scopeId);
	const scopeGroups = groupManager.getGroupsInParent(scopeId).filter((g) => g.id !== newGroupId);
	const newGroup = groupManager.getGroup(newGroupId)!;

	const siblings = [
		...scopeLayers.map((l) => ({ id: l.id, isGroup: false, index: l.index })),
		...scopeGroups.map((g) => ({ id: g.id, isGroup: true, index: g.index })),
		{ id: newGroupId, isGroup: true, index: newGroup.index }
	].sort((a, b) => a.index - b.index);

	for (let i = 0; i < siblings.length; i++) {
		const s = siblings[i];
		if (s.index === i) continue;
		if (s.isGroup) groupManager.updateGroup(s.id, { index: i });
		else layersList.getLayerById(s.id)?.update({ index: i });
	}
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
		groupManager.updateGroup(g.id, { index: g.index, parentId: g.parentId });
	}

	for (const l of snap.layers) {
		layersList.getLayerById(l.id)?.update({ index: l.index, groupId: l.groupId });
	}
}
