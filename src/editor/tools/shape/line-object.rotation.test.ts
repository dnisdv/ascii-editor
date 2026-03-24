import { describe, it, expect, beforeEach } from 'vitest';
import { LineObject } from './line-object';

function makeHorizontalLine(x: number, y: number, length: number): LineObject {
	return new LineObject({ cellX: x, cellY: y, width: length, height: 1 });
}

function makeVerticalLine(x: number, y: number, length: number): LineObject {
	return new LineObject({ cellX: x, cellY: y, width: 1, height: length });
}

function getGeomAnchors(line: LineObject) {
	return line.getAnchors().filter((a) => a.type === 'geometric');
}

describe('LineObject — applyRotation', () => {
	describe('horizontal line (width > height)', () => {
		let line: LineObject;

		beforeEach(() => {
			line = makeHorizontalLine(2, 2, 5);
		});

		it('90°: bounding box flips to vertical (width becomes height)', () => {
			line.applyRotation(90);
			expect(line.getProperty('transform.width')).toBe(1);
			expect(line.getProperty('transform.height')).toBe(5);
		});

		it('180°: bounding box dimensions stay the same', () => {
			line.applyRotation(180);
			expect(line.getProperty('transform.width')).toBe(5);
			expect(line.getProperty('transform.height')).toBe(1);
		});

		it('270°: bounding box flips to vertical', () => {
			line.applyRotation(270);
			expect(line.getProperty('transform.width')).toBe(1);
			expect(line.getProperty('transform.height')).toBe(5);
		});

		it('preserves geometric anchor count after rotation', () => {
			const before = getGeomAnchors(line).length;
			line.applyRotation(90);
			expect(getGeomAnchors(line).length).toBe(before);
		});

		it('preserves the number of geometric anchors after rotation', () => {
			const before = getGeomAnchors(line).length;
			line.applyRotation(90);
			expect(getGeomAnchors(line).length).toBe(before);
		});
	});

	describe('vertical line (height > width)', () => {
		let line: LineObject;

		beforeEach(() => {
			line = makeVerticalLine(2, 2, 5);
		});

		it('90°: bounding box flips to horizontal', () => {
			line.applyRotation(90);
			expect(line.getProperty('transform.width')).toBe(5);
			expect(line.getProperty('transform.height')).toBe(1);
		});
	});

	describe('four 90° rotations', () => {
		it('returns horizontal line to its original bounding box', () => {
			const line = makeHorizontalLine(0, 0, 5);
			const origX = line.getProperty('transform.x');
			const origY = line.getProperty('transform.y');
			const origW = line.getProperty('transform.width');
			const origH = line.getProperty('transform.height');

			line.applyRotation(90);
			line.applyRotation(90);
			line.applyRotation(90);
			line.applyRotation(90);

			expect(line.getProperty('transform.x')).toBe(origX);
			expect(line.getProperty('transform.y')).toBe(origY);
			expect(line.getProperty('transform.width')).toBe(origW);
			expect(line.getProperty('transform.height')).toBe(origH);
		});

		it('returns geometric anchor positions to their originals', () => {
			const line = makeHorizontalLine(0, 0, 5);
			const origAnchors = getGeomAnchors(line).map(({ x, y }) => ({ x, y }));

			line.applyRotation(90);
			line.applyRotation(90);
			line.applyRotation(90);
			line.applyRotation(90);

			const finalAnchors = getGeomAnchors(line).map(({ x, y }) => ({ x, y }));
			expect(finalAnchors).toEqual(origAnchors);
		});
	});

	describe('getRotationContent / restoreRotationContent', () => {
		it('getRotationContent serializes current anchors', () => {
			const line = makeHorizontalLine(0, 0, 5);
			const content = line.getRotationContent();
			expect(() => JSON.parse(content)).not.toThrow();
			expect(JSON.parse(content)).toBeInstanceOf(Array);
		});

		it('restoreRotationContent restores anchor positions after rotation', () => {
			const line = makeHorizontalLine(0, 0, 5);
			const contentBefore = line.getRotationContent();

			line.applyRotation(90);
			expect(line.getRotationContent()).not.toBe(contentBefore);

			line.restoreRotationContent(contentBefore);
			expect(line.getRotationContent()).toBe(contentBefore);
		});

		it('restoreRotationContent ignores invalid JSON gracefully', () => {
			const line = makeHorizontalLine(0, 0, 5);
			expect(() => line.restoreRotationContent('not-json')).not.toThrow();
		});
	});
});
