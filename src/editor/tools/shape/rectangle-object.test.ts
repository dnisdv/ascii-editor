import { describe, it, expect } from 'vitest';
import { RectangleObject } from './rectangle-object';

describe('RectangleObject (behavior, no rendering/mocks)', () => {
	it('hitTest: detects border but not hollow interior (5x5)', () => {
		const rect = new RectangleObject({ cellX: 10, cellY: 10, width: 5, height: 5 });

		expect(rect.hitTest(10, 10)).toBe(true);
		expect(rect.hitTest(14, 14)).toBe(true);

		expect(rect.hitTest(9, 10)).toBe(false);
		expect(rect.hitTest(15, 15)).toBe(false);

		expect(rect.hitTest(12, 12)).toBe(false);
	});

	it('hitTest: thin rectangles have content on their line(s)', () => {
		const vline = new RectangleObject({ cellX: 0, cellY: 0, width: 1, height: 5 });
		expect(vline.hitTest(0, 2)).toBe(true);
		expect(vline.hitTest(1, 2)).toBe(false);

		const hline = new RectangleObject({ cellX: 3, cellY: 3, width: 6, height: 1 });
		expect(hline.hitTest(5, 3)).toBe(true);
		expect(hline.hitTest(2, 3)).toBe(false);
	});

	it('regionHitTest: returns false for regions entirely inside hollow center (>2x2)', () => {
		const rect = new RectangleObject({ cellX: 0, cellY: 0, width: 5, height: 5 });

		expect(rect.regionHitTest({ cellX: 1, cellY: 1, width: 3, height: 3 })).toBe(false);

		expect(rect.regionHitTest({ cellX: 0, cellY: 2, width: 5, height: 1 })).toBe(true);
	});

	it('regionHitTest: thin rectangles (<=2 wide or high) always count on any intersection', () => {
		const thin = new RectangleObject({ cellX: 0, cellY: 0, width: 2, height: 10 });
		expect(thin.regionHitTest({ cellX: 1, cellY: 1, width: 1, height: 8 })).toBe(true);
	});

	it('representation: 1x1 is a solid block', () => {
		const r = new RectangleObject({ cellX: 0, cellY: 0, width: 1, height: 1 });
		expect(r.toAsciiString()).toBe('■');
	});

	it('representation: width=1, height>1 is a vertical line of │', () => {
		const r = new RectangleObject({ cellX: 0, cellY: 0, width: 1, height: 3 });
		expect(r.toAsciiString()).toBe('│\n│\n│');
	});

	it('representation: height=1, width>1 is a horizontal line of ─', () => {
		const r = new RectangleObject({ cellX: 0, cellY: 0, width: 4, height: 1 });
		expect(r.toAsciiString()).toBe('─'.repeat(4));
	});

	it('representation: 4x3 hollow rectangle uses box-drawing characters', () => {
		const r = new RectangleObject({ cellX: 0, cellY: 0, width: 4, height: 3 });
		const s = r.toAsciiString();
		expect(s).toBe(
			['┌' + '─'.repeat(2) + '┐', '│' + ' '.repeat(2) + '│', '└' + '─'.repeat(2) + '┘'].join('\n')
		);
	});

	it('representation: large 300x300 has correct borders and hollow interior', () => {
		const W = 300;
		const H = 300;
		const r = new RectangleObject({ cellX: 0, cellY: 0, width: W, height: H });
		const s = r.toAsciiString();
		expect(s).not.toBeNull();
		const lines = (s as string).split('\n');
		expect(lines.length).toBe(H);

		expect(lines[0]).toBe('┌' + '─'.repeat(W - 2) + '┐');
		expect(lines[H - 1]).toBe('└' + '─'.repeat(W - 2) + '┘');

		const expectedInterior = '│' + ' '.repeat(W - 2) + '│';
		for (let y = 1; y < H - 1; y++) {
			expect(lines[y]).toBe(expectedInterior);
		}
	});

	it('hitTest/regionHitTest: large 300x300 rectangle behaves as hollow box', () => {
		const W = 300;
		const H = 300;
		const rect = new RectangleObject({ cellX: 0, cellY: 0, width: W, height: H });

		expect(rect.hitTest(0, 0)).toBe(true);
		expect(rect.hitTest(W - 1, 0)).toBe(true);
		expect(rect.hitTest(0, H - 1)).toBe(true);
		expect(rect.hitTest(W - 1, H - 1)).toBe(true);

		expect(rect.hitTest(0, 10)).toBe(true);
		expect(rect.hitTest(W - 1, 123)).toBe(true);
		expect(rect.hitTest(42, 0)).toBe(true);
		expect(rect.hitTest(17, H - 1)).toBe(true);

		expect(rect.hitTest(1, 1)).toBe(false);
		expect(rect.hitTest(W - 2, H - 2)).toBe(false);
		expect(rect.hitTest(Math.floor(W / 2), Math.floor(H / 2))).toBe(false);

		expect(rect.regionHitTest({ cellX: 10, cellY: 10, width: W - 20, height: H - 20 })).toBe(false);

		expect(rect.regionHitTest({ cellX: -10, cellY: 10, width: 20, height: 20 })).toBe(true);
		expect(rect.regionHitTest({ cellX: 10, cellY: -10, width: 20, height: 20 })).toBe(true);

		expect(rect.regionHitTest({ cellX: W + 1, cellY: H + 1, width: 10, height: 10 })).toBe(false);
	});

	it('clone: preserves id and properties (behavior important for history)', () => {
		const a = new RectangleObject({ cellX: 7, cellY: 8, width: 9, height: 10 });
		const id = a.id;
		const b = a.clone() as RectangleObject;

		expect(b.id).toBe(id);

		expect(b.getProperty('transform.x')).toBe(7);
		expect(b.getProperty('transform.y')).toBe(8);
		expect(b.getProperty('transform.width')).toBe(9);
		expect(b.getProperty('transform.height')).toBe(10);
	});
});
