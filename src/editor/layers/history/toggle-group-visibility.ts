import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { LayersManager } from '../layers-manager';
import type { LayersExecutionContext } from './history-context';
import type { LayerGroupManager } from '../layer-group-manager';
import type { LayersListManager } from '../layer-list-manager';

type Snapshot = {
	layers: { id: string; visible: boolean }[];
	groups: { id: string; visible: boolean }[];
};

export interface ToggleGroupVisibilityPayload {
	groupId: string;
}

export const toggleGroupVisibilityAction = createActionDefinition<
	'layers::toggleGroupVisibility',
	ToggleGroupVisibilityPayload,
	void
>('layers::toggleGroupVisibility');

export interface ToggleGroupVisibilityAction extends BaseAction {
	type: typeof toggleGroupVisibilityAction.type;
	before: Snapshot;
	after: Snapshot;
}

export class ToggleGroupVisibility
	implements
		ActionHandler<
			ToggleGroupVisibilityAction,
			typeof toggleGroupVisibilityAction._result,
			typeof toggleGroupVisibilityAction._payload
		>
{
	execute(
		target: LayersManager,
		context: LayersExecutionContext,
		payload: ToggleGroupVisibilityPayload
	): [ToggleGroupVisibilityAction, void] {
		const layersList = context.layersListManager;
		const groupManager = target.getGroupManager();

		const group = groupManager.getGroup(payload.groupId);
		if (!group) {
			const empty: Snapshot = { layers: [], groups: [] };
			return [buildAction(empty, empty), undefined];
		}

		const { groupIds, layerIds } = collectAffectedIds(payload.groupId, layersList, groupManager);

		const before = snapshot(groupIds, layerIds, layersList, groupManager);
		applyVisibility(!group.opts.visible, groupIds, layerIds, layersList, groupManager);
		const after = snapshot(groupIds, layerIds, layersList, groupManager);

		return [buildAction(before, after), undefined];
	}

	apply(action: ToggleGroupVisibilityAction, target: LayersManager, context: LayersExecutionContext): void {
		restore(action.after, target, context);
	}

	revert(action: ToggleGroupVisibilityAction, target: LayersManager, context: LayersExecutionContext): void {
		restore(action.before, target, context);
	}
}

function buildAction(before: Snapshot, after: Snapshot): ToggleGroupVisibilityAction {
	return { type: toggleGroupVisibilityAction.type, targetId: 'layers', before, after };
}

function collectAffectedIds(
	groupId: string,
	layersList: LayersListManager,
	groupManager: LayerGroupManager
): { groupIds: string[]; layerIds: string[] } {
	const groupIds = [groupId, ...groupManager.getChildGroupIds(groupId)];
	const groupIdSet = new Set(groupIds);

	const layerIds: string[] = [];
	for (const l of layersList.getSortedLayers()) {
		if (l.groupId && groupIdSet.has(l.groupId)) layerIds.push(l.id);
	}

	return { groupIds, layerIds };
}

function applyVisibility(
	visible: boolean,
	groupIds: string[],
	layerIds: string[],
	layersList: LayersListManager,
	groupManager: LayerGroupManager
): void {
	for (const id of groupIds) groupManager.updateGroup(id, { opts: { visible } });
	for (const id of layerIds) layersList.getLayerById(id)?.update({ opts: { visible } });
}

function snapshot(
	groupIds: string[],
	layerIds: string[],
	layersList: LayersListManager,
	groupManager: LayerGroupManager
): Snapshot {
	return {
		layers: layerIds.map((id) => ({
			id,
			visible: layersList.getLayerById(id)!.getOpts().visible
		})),
		groups: groupIds.map((id) => ({
			id,
			visible: groupManager.getGroup(id)!.opts.visible
		}))
	};
}

function restore(snap: Snapshot, target: LayersManager, context: LayersExecutionContext): void {
	const layersList = context.layersListManager;
	const groupManager = target.getGroupManager();

	for (const g of snap.groups) {
		if (groupManager.hasGroup(g.id)) groupManager.updateGroup(g.id, { opts: { visible: g.visible } });
	}

	for (const l of snap.layers) {
		layersList.getLayerById(l.id)?.update({ opts: { visible: l.visible } });
	}
}
