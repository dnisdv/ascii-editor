import { describe, it, expect } from 'vitest';
import { ScopeIndexAllocator } from './scope-index-allocator';

describe('ScopeIndexAllocator', () => {
	describe('empty', () => {
		it('returns 0 when no items exist', () => {
			const alloc = ScopeIndexAllocator.empty();
			expect(alloc.next(null)).toBe(0);
			expect(alloc.next('scope-1')).toBe(0);
		});
	});

	describe('forLayers', () => {
		it('returns max+1 of layers in the given scope', () => {
			const layers = [
				{ id: 'L0', groupId: null, index: 0 },
				{ id: 'L1', groupId: null, index: 1 },
				{ id: 'L2', groupId: 'g1', index: 0 }
			];
			const alloc = ScopeIndexAllocator.forLayers(() => layers);

			expect(alloc.next(null)).toBe(2);
			expect(alloc.next('g1')).toBe(1);
			expect(alloc.next('g2')).toBe(0);
		});

		it('excludes a layer by id', () => {
			const layers = [
				{ id: 'L0', groupId: null, index: 0 },
				{ id: 'L1', groupId: null, index: 1 }
			];
			const alloc = ScopeIndexAllocator.forLayers(() => layers);

			expect(alloc.next(null, 'L1')).toBe(1);
		});
	});

	describe('forGroups', () => {
		it('returns max+1 of groups in the given scope', () => {
			const groups = [
				{ id: 'G0', parentId: null, index: 0 },
				{ id: 'G1', parentId: null, index: 1 },
				{ id: 'G2', parentId: 'G0', index: 0 }
			];
			const alloc = ScopeIndexAllocator.forGroups(() => groups);

			expect(alloc.next(null)).toBe(2);
			expect(alloc.next('G0')).toBe(1);
		});

		it('excludes a group by id', () => {
			const groups = [
				{ id: 'G0', parentId: null, index: 0 },
				{ id: 'G1', parentId: null, index: 3 }
			];
			const alloc = ScopeIndexAllocator.forGroups(() => groups);

			expect(alloc.next(null, 'G1')).toBe(1);
		});
	});

	describe('forLayersAndGroups', () => {
		it('returns max+1 across both layers and groups in the same scope', () => {
			const layers = [{ id: 'L0', groupId: null, index: 0 }];
			const groups = [{ id: 'G0', parentId: null, index: 2 }];
			const alloc = ScopeIndexAllocator.forLayersAndGroups(() => layers, () => groups);

			expect(alloc.next(null)).toBe(3);
		});

		it('scopes correctly for child scope', () => {
			const layers = [
				{ id: 'L0', groupId: 'G0', index: 0 },
				{ id: 'L1', groupId: 'G0', index: 1 }
			];
			const groups = [
				{ id: 'G0', parentId: null, index: 0 },
				{ id: 'G1', parentId: 'G0', index: 2 }
			];
			const alloc = ScopeIndexAllocator.forLayersAndGroups(() => layers, () => groups);

			expect(alloc.next('G0')).toBe(3);
			expect(alloc.next(null)).toBe(1);
		});
	});

	describe('nextOnScopeChange', () => {
		it('returns undefined when newScope is undefined', () => {
			const alloc = ScopeIndexAllocator.empty();
			expect(alloc.nextOnScopeChange(undefined, null, undefined)).toBeUndefined();
		});

		it('returns undefined when scope has not changed', () => {
			const alloc = ScopeIndexAllocator.empty();
			expect(alloc.nextOnScopeChange(null, null, undefined)).toBeUndefined();
			expect(alloc.nextOnScopeChange('G0', 'G0', undefined)).toBeUndefined();
		});

		it('returns undefined when explicitIndex is provided', () => {
			const alloc = ScopeIndexAllocator.empty();
			expect(alloc.nextOnScopeChange('G1', null, 5)).toBeUndefined();
		});

		it('returns next index when scope actually changes', () => {
			const layers = [{ id: 'L0', groupId: 'G1', index: 0 }];
			const alloc = ScopeIndexAllocator.forLayers(() => layers);

			expect(alloc.nextOnScopeChange('G1', null, undefined)).toBe(1);
		});

		it('returns 0 when moving to empty scope', () => {
			const alloc = ScopeIndexAllocator.empty();
			expect(alloc.nextOnScopeChange('G1', null, undefined)).toBe(0);
		});
	});
});
