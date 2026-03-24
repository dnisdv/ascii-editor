import { describe, it, expect, beforeEach } from 'vitest';
import { RectangleObject } from './rectangle-object';

describe('RectangleObject — applyRotation', () => {
	let rect: RectangleObject;

	beforeEach(() => {
		rect = new RectangleObject({ cellX: 5, cellY: 5, width: 4, height: 6 });
	});

	it('90°: swaps width and height', () => {
		rect.applyRotation(90);
		expect(rect.getProperty('transform.width')).toBe(6);
		expect(rect.getProperty('transform.height')).toBe(4);
	});

	it('90°: re-centers position so bounding box stays centered', () => {
		rect.applyRotation(90);
		// newX = 5 + round((4 - 6) / 2) = 4, newY = 5 + round((6 - 4) / 2) = 6
		expect(rect.getProperty('transform.x')).toBe(4);
		expect(rect.getProperty('transform.y')).toBe(6);
	});

	it('270°: same dimension swap as 90°', () => {
		rect.applyRotation(270);
		expect(rect.getProperty('transform.width')).toBe(6);
		expect(rect.getProperty('transform.height')).toBe(4);
	});

	it('-90°: same dimension swap as 90°', () => {
		rect.applyRotation(-90);
		expect(rect.getProperty('transform.width')).toBe(6);
		expect(rect.getProperty('transform.height')).toBe(4);
	});

	it('180°: preserves width and height', () => {
		rect.applyRotation(180);
		expect(rect.getProperty('transform.width')).toBe(4);
		expect(rect.getProperty('transform.height')).toBe(6);
	});

	it('180°: preserves position', () => {
		rect.applyRotation(180);
		expect(rect.getProperty('transform.x')).toBe(5);
		expect(rect.getProperty('transform.y')).toBe(5);
	});

	it('90° rotated then 180° still modifies dimensions correctly', () => {
		rect.applyRotation(90);
		const w = rect.getProperty('transform.width');
		const h = rect.getProperty('transform.height');
		rect.applyRotation(180);
		// 180° swaps back, so dimensions should be the same as after 90°
		expect(rect.getProperty('transform.width')).toBe(w);
		expect(rect.getProperty('transform.height')).toBe(h);
	});

	it('square: 90° preserves position and dimensions', () => {
		const square = new RectangleObject({ cellX: 3, cellY: 3, width: 5, height: 5 });
		square.applyRotation(90);
		expect(square.getProperty('transform.x')).toBe(3);
		expect(square.getProperty('transform.y')).toBe(3);
		expect(square.getProperty('transform.width')).toBe(5);
		expect(square.getProperty('transform.height')).toBe(5);
	});

	it('four 90° rotations return to original position and dimensions', () => {
		const origX = rect.getProperty('transform.x');
		const origY = rect.getProperty('transform.y');
		const origW = rect.getProperty('transform.width');
		const origH = rect.getProperty('transform.height');

		rect.applyRotation(90);
		rect.applyRotation(90);
		rect.applyRotation(90);
		rect.applyRotation(90);

		expect(rect.getProperty('transform.x')).toBe(origX);
		expect(rect.getProperty('transform.y')).toBe(origY);
		expect(rect.getProperty('transform.width')).toBe(origW);
		expect(rect.getProperty('transform.height')).toBe(origH);
	});

	it('two 90° rotations equal one 180°', () => {
		const r1 = new RectangleObject({ cellX: 5, cellY: 5, width: 4, height: 6 });
		const r2 = new RectangleObject({ cellX: 5, cellY: 5, width: 4, height: 6 });

		r1.applyRotation(90);
		r1.applyRotation(90);
		r2.applyRotation(180);

		expect(r1.getProperty('transform.x')).toBe(r2.getProperty('transform.x'));
		expect(r1.getProperty('transform.y')).toBe(r2.getProperty('transform.y'));
		expect(r1.getProperty('transform.width')).toBe(r2.getProperty('transform.width'));
		expect(r1.getProperty('transform.height')).toBe(r2.getProperty('transform.height'));
	});
});
