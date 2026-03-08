import { describe, it, expect, beforeEach } from 'vitest';
import { PropertyManager } from './property-manager';
import {
	StandardGroupKeys,
	TransformProperties,
	MetaProperties,
	FillAndStrokeProperties,
	type Properties
} from './properties';
import type { ObjectOperation } from '@editor/types';

function makeProps(): Properties {
	return {
		[StandardGroupKeys.META]: {
			[MetaProperties.NAME]: { type: 'string', value: 'Test' }
		},
		[StandardGroupKeys.TRANSFORM]: {
			[TransformProperties.X]: { type: 'number', value: 1 },
			[TransformProperties.Y]: { type: 'number', value: 2 },
			[TransformProperties.WIDTH]: { type: 'number', value: 10 },
			[TransformProperties.HEIGHT]: { type: 'number', value: 5 },
			[TransformProperties.ROTATION]: { type: 'number', value: 0 }
		},
		[StandardGroupKeys.FILL_AND_STROKE]: {
			[FillAndStrokeProperties.STROKE_WIDTH]: { type: 'number', value: 1 },
			[FillAndStrokeProperties.STROKE_COLOR]: { type: 'string', value: '#000' },
			[FillAndStrokeProperties.FILL_COLOR]: { type: 'string', value: '#fff' }
		}
	};
}

describe('PropertyManager', () => {
	let ops: ObjectOperation[];
	let visualChangedCount: number;
	let pm: PropertyManager<Properties>;
	let initial: Properties;

	beforeEach(() => {
		ops = [];
		visualChangedCount = 0;
		initial = makeProps();
		pm = new PropertyManager(
			initial,
			(o) => {
				ops.push(...o);
			},
			() => {
				visualChangedCount++;
			}
		);
	});

	it('get and getCommitted reflect staged vs committed', () => {
		expect(pm.getCommitted('transform.x')).toBe(1);
		expect(pm.get('transform.x')).toBe(1);

		pm.setVisual('transform.x', 99);
		expect(pm.get('transform.x')).toBe(99);
		expect(pm.getCommitted('transform.x')).toBe(1);

		expect(pm.get('transform.y')).toBe(2);
	});

	it('set changes committed and emits ops (no visual callback)', () => {
		pm.set('transform.x', 7);
		expect(pm.getCommitted('transform.x')).toBe(7);
		expect(pm.get('transform.x')).toBe(7);
		expect(ops).toEqual([{ op: 'replace', path: 'transform.x.value', value: 7 }]);
		expect(visualChangedCount).toBe(0);
	});

	it('setVisual stages value, deduplicates, and triggers visual change', () => {
		pm.setVisual('transform.x', 3);
		expect(pm.get('transform.x')).toBe(3);
		expect(visualChangedCount).toBe(1);

		pm.setVisual('transform.x', 3);
		expect(visualChangedCount).toBe(1);

		pm.setVisual('transform.x', 4);
		expect(pm.get('transform.x')).toBe(4);
		expect(visualChangedCount).toBe(2);
	});

	it('listVisualKeys and hasVisual report staged state', () => {
		expect(pm.listVisualKeys()).toEqual([]);
		expect(pm.hasVisual('transform.x')).toBe(false);
		pm.setVisual('transform.x', 9);
		pm.setVisual('transform.y', 8);
		expect(new Set(pm.listVisualKeys())).toEqual(new Set(['transform.x', 'transform.y']));
		expect(pm.hasVisual('transform.x')).toBe(true);
	});

	it('commit() with specific paths commits only those staged values in one ops batch', () => {
		pm.setVisual('transform.x', 11);
		pm.setVisual('transform.y', 22);
		ops = [];
		visualChangedCount = 0;

		pm.commit(['transform.x']);

		expect(pm.getCommitted('transform.x')).toBe(11);
		expect(pm.get('transform.y')).toBe(22);
		expect(pm.getCommitted('transform.y')).toBe(2);

		expect(ops).toEqual([{ op: 'replace', path: 'transform.x.value', value: 11 }]);
		expect(visualChangedCount).toBe(1);

		ops = [];
		pm.commit();
		expect(ops).toEqual([{ op: 'replace', path: 'transform.y.value', value: 22 }]);
		expect(pm.getCommitted('transform.y')).toBe(22);
	});

	it('commit() with no staged values is a no-op (no events)', () => {
		ops = [];
		visualChangedCount = 0;
		pm.commit();
		expect(ops.length).toBe(0);
		expect(visualChangedCount).toBe(0);
	});

	it('discard(paths) removes staged values selectively and triggers visual change only when something changed', () => {
		pm.setVisual('transform.x', 50);
		pm.setVisual('transform.y', 60);
		visualChangedCount = 0;

		pm.discard(['transform.x']);
		expect(pm.hasVisual('transform.x')).toBe(false);
		expect(pm.hasVisual('transform.y')).toBe(true);
		expect(visualChangedCount).toBe(1);

		pm.discard(['fill_and_stroke.strokeWidth']);
		expect(visualChangedCount).toBe(1);

		pm.discard();
		expect(pm.listVisualKeys().length).toBe(0);
		expect(visualChangedCount).toBe(2);
	});

	it('commitAll and discardAll convenience methods', () => {
		pm.setVisual('transform.x', 5);
		pm.setVisual('transform.y', 6);

		ops = [];
		pm.commitAll();
		expect(pm.getCommitted('transform.x')).toBe(5);
		expect(pm.getCommitted('transform.y')).toBe(6);
		expect(ops).toEqual([
			{ op: 'replace', path: 'transform.x.value', value: 5 },
			{ op: 'replace', path: 'transform.y.value', value: 6 }
		]);

		pm.setVisual('transform.x', 100);
		pm.setVisual('transform.y', 200);
		expect(pm.listVisualKeys().length).toBe(2);
		pm.discardAll();
		expect(pm.listVisualKeys().length).toBe(0);
	});

	it('applyCommitted mutates committed state and emits ops but keeps staged values intact', () => {
		pm.setVisual('transform.x', 123);

		ops = [];
		pm.applyCommitted('transform.x', 77);

		expect(pm.getCommitted('transform.x')).toBe(77);
		expect(pm.get('transform.x')).toBe(123);
		expect(ops).toEqual([{ op: 'replace', path: 'transform.x.value', value: 77 }]);
	});

	it('snapshot includes only committed values; setFromSnapshot replaces committed and leaves staging', () => {
		pm.setVisual('transform.x', 321);
		const snap = pm.snapshot();
		// @ts-expect-error runtime structure;
		expect(snap.transform.x.value).toBe(1);

		const newProps: Properties = makeProps();
		// @ts-expect-error runtime structure
		newProps.transform.x.value = 42;
		// @ts-expect-error runtime structure
		newProps.transform.y.value = 43;

		pm.setFromSnapshot(newProps);

		expect(pm.getCommitted('transform.x')).toBe(42);
		expect(pm.getCommitted('transform.y')).toBe(43);

		expect(pm.get('transform.x')).toBe(321);
		expect(pm.get('transform.y')).toBe(43);
	});
});
