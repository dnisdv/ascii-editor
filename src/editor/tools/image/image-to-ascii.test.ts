import { describe, it, expect } from 'vitest';
import {
	DEFAULT_ASCII_PARAMS,
	RAMPS,
	fitGridSize,
	imageToAscii,
	resolveRamp,
	sampleLuma,
	type AsciiParams,
	type ImageSource
} from './image-to-ascii';

function solid(width: number, height: number, value: number, alpha = 255): ImageSource {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let i = 0; i < width * height; i++) {
		data[i * 4] = value;
		data[i * 4 + 1] = value;
		data[i * 4 + 2] = value;
		data[i * 4 + 3] = alpha;
	}
	return { width, height, data };
}

/** Left half black, right half white. */
function splitVertical(width: number, height: number): ImageSource {
	const src = solid(width, height, 255);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width / 2; x++) {
			const i = (y * width + x) * 4;
			src.data[i] = 0;
			src.data[i + 1] = 0;
			src.data[i + 2] = 0;
		}
	}
	return src;
}

function params(overrides: Partial<AsciiParams> = {}): AsciiParams {
	return { ...DEFAULT_ASCII_PARAMS, ...overrides };
}

describe('sampleLuma', () => {
	it('normalizes a white image to 1 and a black image to 0', () => {
		expect(Array.from(sampleLuma(solid(4, 4, 255), 2, 2, params()))).toEqual([1, 1, 1, 1]);
		expect(Array.from(sampleLuma(solid(4, 4, 0), 2, 2, params()))).toEqual([0, 0, 0, 0]);
	});

	it('averages the pixels covered by each cell', () => {
		const luma = sampleLuma(splitVertical(4, 2), 2, 1, params());
		expect(luma[0]).toBe(0);
		expect(luma[1]).toBe(1);
	});

	it('composites transparent pixels over white', () => {
		const luma = sampleLuma(solid(2, 2, 0, 0), 1, 1, params());
		expect(luma[0]).toBe(1);
	});

	it('inverts when the invert flag is set', () => {
		const luma = sampleLuma(solid(2, 2, 255), 1, 1, params({ invert: true }));
		expect(luma[0]).toBe(0);
	});

	it('pushes mid grey apart with positive contrast', () => {
		const plain = sampleLuma(solid(2, 2, 200), 1, 1, params());
		const boosted = sampleLuma(solid(2, 2, 200), 1, 1, params({ contrast: 60 }));
		expect(boosted[0]).toBeGreaterThan(plain[0]);
	});
});

describe('resolveRamp', () => {
	it('returns the named ramp', () => {
		expect(resolveRamp(params({ charset: 'blocks' }))).toBe(RAMPS.blocks);
	});

	it('falls back to the standard ramp when the custom ramp is too short', () => {
		expect(resolveRamp(params({ charset: 'custom', customRamp: 'x' }))).toBe(RAMPS.standard);
	});

	it('uses the custom ramp when it has at least two characters', () => {
		expect(resolveRamp(params({ charset: 'custom', customRamp: ' @' }))).toBe(' @');
	});
});

describe('fitGridSize', () => {
	it('keeps the aspect ratio through the character cell ratio', () => {
		expect(fitGridSize(100, 100, 20, 0.5)).toEqual({ cols: 20, rows: 10 });
	});

	it('never returns an empty grid', () => {
		expect(fitGridSize(1000, 1, 10, 0.5)).toEqual({ cols: 10, rows: 1 });
	});
});

describe('imageToAscii', () => {
	it('emits one line per row with one character per column', () => {
		const out = imageToAscii(splitVertical(8, 8), 4, 3, params());
		const lines = out.split('\n');
		expect(lines).toHaveLength(3);
		for (const line of lines) expect(line).toHaveLength(4);
	});

	it('maps bright cells to the light end of the ramp and dark cells to the dense end', () => {
		const line = imageToAscii(splitVertical(8, 2), 2, 1, params({ charset: 'standard' }));
		expect(line).toBe('@ ');
	});

	it('inverse mode swaps the mapping', () => {
		const line = imageToAscii(splitVertical(8, 2), 2, 1, params({ mode: 'inverse' }));
		expect(line).toBe(' @');
	});

	it('threshold mode only keeps cells below the cut point', () => {
		const line = imageToAscii(splitVertical(8, 2), 2, 1, params({ mode: 'threshold', threshold: 50 }));
		expect(line).toBe('@ ');
	});

	it('dither mode is deterministic', () => {
		const src = splitVertical(16, 16);
		const a = imageToAscii(src, 8, 4, params({ mode: 'dither' }));
		const b = imageToAscii(src, 8, 4, params({ mode: 'dither' }));
		expect(a).toBe(b);
	});

	it('ordered mode keeps the grid shape', () => {
		const out = imageToAscii(splitVertical(16, 16), 8, 4, params({ mode: 'ordered' }));
		expect(out.split('\n').every((line) => line.length === 8)).toBe(true);
	});

	it('edges mode marks the border between the halves and leaves flat areas blank', () => {
		const out = imageToAscii(splitVertical(16, 8), 8, 4, params({ mode: 'edges' }));
		const lines = out.split('\n');
		expect(lines[0][0]).toBe(' ');
		expect(lines[0].slice(3, 5)).toBe('||');
	});

	it('blocks mode uses quadrant characters', () => {
		const out = imageToAscii(splitVertical(8, 8), 2, 2, params({ mode: 'blocks' }));
		expect(out.split('\n')[0]).toBe('█ ');
	});

	it('braille mode uses braille characters for dark areas', () => {
		const out = imageToAscii(splitVertical(8, 8), 2, 2, params({ mode: 'braille' }));
		expect(out.split('\n')[0]).toBe('⣿ ');
	});

	it('renders a blank image as spaces', () => {
		const out = imageToAscii(solid(4, 4, 255), 2, 2, params());
		expect(out).toBe('  \n  ');
	});
});
