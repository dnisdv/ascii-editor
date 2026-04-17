import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LayerSelectionManager } from './layer-selection-manager';
import { Layer } from './layer';
import { Config } from '@editor/config';

function makeLayer(id: string, index: number): Layer {
	return new Layer({ id, name: id, index, opts: {}, config: new Config() });
}

describe('LayerSelectionManager', () => {
	let mgr: LayerSelectionManager;
	let layers: Layer[];

	beforeEach(() => {
		layers = [makeLayer('A', 0), makeLayer('B', 1), makeLayer('C', 2)];
		mgr = new LayerSelectionManager(() => layers);
	});

	describe('initial state', () => {
		it('starts with no selection', () => {
			expect(mgr.getSelectedLayerIds()).toEqual([]);
		});

		it('isLayerSelected returns false for any id', () => {
			expect(mgr.isLayerSelected('A')).toBe(false);
		});
	});

	describe('selectLayer', () => {
		it('selects a single layer', () => {
			mgr.selectLayer('A');
			expect(mgr.getSelectedLayerIds()).toEqual(['A']);
			expect(mgr.isLayerSelected('A')).toBe(true);
		});

		it('replaces selection when addToSelection is false (default)', () => {
			mgr.selectLayer('A');
			mgr.selectLayer('B');
			expect(mgr.getSelectedLayerIds()).toEqual(['B']);
		});

		it('adds to selection when addToSelection is true', () => {
			mgr.selectLayer('A');
			mgr.selectLayer('B', true);
			expect(mgr.getSelectedLayerIds()).toContain('A');
			expect(mgr.getSelectedLayerIds()).toContain('B');
		});

		it('emits layer::selection::changed', () => {
			const spy = vi.fn();
			mgr.on('layer::selection::changed', spy);
			mgr.selectLayer('A');
			expect(spy).toHaveBeenCalledWith({ selectedIds: ['A'] });
		});
	});

	describe('deselectLayer', () => {
		it('removes a layer from selection', () => {
			mgr.selectLayer('A');
			mgr.selectLayer('B', true);
			mgr.deselectLayer('A');
			expect(mgr.getSelectedLayerIds()).toEqual(['B']);
		});

		it('is a no-op for unselected layer', () => {
			mgr.selectLayer('A');
			mgr.deselectLayer('B');
			expect(mgr.getSelectedLayerIds()).toEqual(['A']);
		});

		it('emits layer::selection::changed', () => {
			mgr.selectLayer('A');
			const spy = vi.fn();
			mgr.on('layer::selection::changed', spy);
			mgr.deselectLayer('A');
			expect(spy).toHaveBeenCalledWith({ selectedIds: [] });
		});
	});

	describe('toggleLayerSelection', () => {
		it('selects an unselected layer', () => {
			mgr.toggleLayerSelection('A');
			expect(mgr.isLayerSelected('A')).toBe(true);
		});

		it('deselects a selected layer', () => {
			mgr.selectLayer('A');
			mgr.toggleLayerSelection('A');
			expect(mgr.isLayerSelected('A')).toBe(false);
		});

		it('emits layer::selection::changed', () => {
			const spy = vi.fn();
			mgr.on('layer::selection::changed', spy);
			mgr.toggleLayerSelection('A');
			expect(spy).toHaveBeenCalledOnce();
		});
	});

	describe('selectLayerRange', () => {
		it('selects a range from A to C', () => {
			mgr.selectLayerRange('A', 'C');
			expect(mgr.getSelectedLayerIds()).toContain('A');
			expect(mgr.getSelectedLayerIds()).toContain('B');
			expect(mgr.getSelectedLayerIds()).toContain('C');
		});

		it('selects a range in reverse order (C to A)', () => {
			mgr.selectLayerRange('C', 'A');
			expect(mgr.getSelectedLayerIds()).toHaveLength(3);
		});

		it('selects only one layer when from === to', () => {
			mgr.selectLayerRange('B', 'B');
			expect(mgr.getSelectedLayerIds()).toEqual(['B']);
		});

		it('adds to existing selection', () => {
			mgr.selectLayer('A');
			mgr.selectLayerRange('B', 'C');
			expect(mgr.getSelectedLayerIds()).toContain('A');
			expect(mgr.getSelectedLayerIds()).toContain('B');
			expect(mgr.getSelectedLayerIds()).toContain('C');
		});

		it('is a no-op if fromId is unknown', () => {
			mgr.selectLayerRange('unknown', 'A');
			expect(mgr.getSelectedLayerIds()).toEqual([]);
		});

		it('is a no-op if toId is unknown', () => {
			mgr.selectLayerRange('A', 'unknown');
			expect(mgr.getSelectedLayerIds()).toEqual([]);
		});

		it('emits layer::selection::changed', () => {
			const spy = vi.fn();
			mgr.on('layer::selection::changed', spy);
			mgr.selectLayerRange('A', 'B');
			expect(spy).toHaveBeenCalledOnce();
		});
	});

	describe('clearLayerSelection', () => {
		it('removes all selections', () => {
			mgr.selectLayer('A');
			mgr.selectLayer('B', true);
			mgr.clearLayerSelection();
			expect(mgr.getSelectedLayerIds()).toEqual([]);
		});

		it('emits layer::selection::changed with empty array', () => {
			mgr.selectLayer('A');
			const spy = vi.fn();
			mgr.on('layer::selection::changed', spy);
			mgr.clearLayerSelection();
			expect(spy).toHaveBeenCalledWith({ selectedIds: [] });
		});
	});
});
