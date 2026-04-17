export class ScopeIndexAllocator {
	constructor(
		private layerIndices: (scopeId: string | null, excludeId?: string) => number[],
		private groupIndices: (scopeId: string | null, excludeId?: string) => number[]
	) {}

	static empty(): ScopeIndexAllocator {
		return new ScopeIndexAllocator(() => [], () => []);
	}

	static forLayers(getLayers: () => Iterable<{ id: string; groupId: string | null; index: number }>): ScopeIndexAllocator {
		return new ScopeIndexAllocator(
			(scopeId, excludeId) => {
				const result: number[] = [];
				for (const l of getLayers()) {
					if ((l.groupId ?? null) === scopeId && l.id !== excludeId) result.push(l.index);
				}
				return result;
			},
			() => []
		);
	}

	static forGroups(getGroups: () => Iterable<{ id: string; parentId: string | null; index: number }>): ScopeIndexAllocator {
		return new ScopeIndexAllocator(
			() => [],
			(scopeId, excludeId) => {
				const result: number[] = [];
				for (const g of getGroups()) {
					if (g.parentId === scopeId && g.id !== excludeId) result.push(g.index);
				}
				return result;
			}
		);
	}

	static forLayersAndGroups(
		getLayers: () => Iterable<{ id: string; groupId: string | null; index: number }>,
		getGroups: () => Iterable<{ id: string; parentId: string | null; index: number }>
	): ScopeIndexAllocator {
		return new ScopeIndexAllocator(
			(scopeId, excludeId) => {
				const result: number[] = [];
				for (const l of getLayers()) {
					if ((l.groupId ?? null) === scopeId && l.id !== excludeId) result.push(l.index);
				}
				return result;
			},
			(scopeId, excludeId) => {
				const result: number[] = [];
				for (const g of getGroups()) {
					if (g.parentId === scopeId && g.id !== excludeId) result.push(g.index);
				}
				return result;
			}
		);
	}

	next(scopeId: string | null, excludeId?: string): number {
		let max = -1;
		for (const idx of this.layerIndices(scopeId, excludeId)) {
			if (idx > max) max = idx;
		}
		for (const idx of this.groupIndices(scopeId, excludeId)) {
			if (idx > max) max = idx;
		}
		return max + 1;
	}

	nextOnScopeChange(
		newScope: string | null | undefined,
		currentScope: string | null,
		explicitIndex: number | undefined,
		excludeId?: string
	): number | undefined {
		if (newScope === undefined) return undefined;
		if ((newScope ?? null) === (currentScope ?? null)) return undefined;
		if (explicitIndex !== undefined) return undefined;
		return this.next(newScope ?? null, excludeId);
	}
}
