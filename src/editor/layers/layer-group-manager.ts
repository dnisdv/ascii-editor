import { EventEmitter } from '@editor/event-emitter';
import { nanoid } from '@reduxjs/toolkit';
import { defaultLayerGroupConfig, type ILayerGroup, type LayerGroupConfig } from '@editor/types/external/layer-group';
import type { DeepPartial } from '@editor/types';
import { ScopeIndexAllocator } from './scope-index-allocator';

export type LayerGroupEvents = {
	'group::added': { group: ILayerGroup };
	'group::removed': { id: string };
	'group::updated': { id: string } & DeepPartial<ILayerGroup>;
};

export class LayerGroupManager extends EventEmitter<LayerGroupEvents> {
	private groups: Map<string, ILayerGroup> = new Map();
	private scopeIndex: ScopeIndexAllocator;

	constructor(scopeIndex: ScopeIndexAllocator) {
		super();
		this.scopeIndex = scopeIndex;
	}

	public createGroupObject(name: string, parentId: string | null = null): ILayerGroup {
		const id = nanoid();
		return {
			id,
			name,
			collapsed: false,
			parentId,
			index: this.scopeIndex!.next(parentId),
			opts: { ...defaultLayerGroupConfig }
		};
	}

	public addGroup(group: ILayerGroup): void {
		this.groups.set(group.id, group);
		this.emit('group::added', { group });
	}

	public removeGroup(id: string): void {
		if (!this.groups.has(id)) return;
		this.groups.delete(id);
		this.emit('group::removed', { id });
	}

	public updateGroup(id: string, updates: DeepPartial<ILayerGroup>): void {
		const group = this.groups.get(id);
		if (!group) return;

		const autoIndex = this.scopeIndex.nextOnScopeChange(updates.parentId, group.parentId, updates.index, id);
		if (autoIndex !== undefined) updates = { ...updates, index: autoIndex };

		if (updates.name !== undefined) group.name = updates.name;
		if (updates.collapsed !== undefined) group.collapsed = updates.collapsed;
		if (updates.parentId !== undefined) group.parentId = updates.parentId ?? null;
		if (updates.index !== undefined) group.index = updates.index;
		if (updates.opts) {
			group.opts = { ...group.opts, ...updates.opts } as LayerGroupConfig;
		}

		this.emit('group::updated', { id, ...updates });
	}

	public getGroup(id: string): ILayerGroup | undefined {
		return this.groups.get(id);
	}

	public getGroups(): ILayerGroup[] {
		return Array.from(this.groups.values());
	}

	public getGroupsInParent(parentId: string | null): ILayerGroup[] {
		return this.getGroups()
			.filter((g) => g.parentId === parentId)
			.sort((a, b) => a.index - b.index);
	}

	public getChildGroupIds(groupId: string): string[] {
		const result: string[] = [];
		const stack = [groupId];
		while (stack.length > 0) {
			const current = stack.pop()!;
			const children = this.getGroupsInParent(current);
			for (const child of children) {
				result.push(child.id);
				stack.push(child.id);
			}
		}
		return result;
	}

	public hasGroup(id: string): boolean {
		return this.groups.has(id);
	}

	public clear(): void {
		this.groups.clear();
	}

}
