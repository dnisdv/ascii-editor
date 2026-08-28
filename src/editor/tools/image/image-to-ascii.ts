export type ImageSource = {
	width: number;
	height: number;
	data: Uint8ClampedArray;
};

export const ASCII_MODES = [
	'luminance',
	'inverse',
	'threshold',
	'dither',
	'ordered',
	'edges',
	'blocks',
	'braille'
] as const;
export type AsciiMode = (typeof ASCII_MODES)[number];

export const ASCII_CHARSETS = ['standard', 'detailed', 'minimal', 'blocks', 'binary', 'custom'] as const;
export type AsciiCharset = (typeof ASCII_CHARSETS)[number];

const CLASSIC_RAMP = '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`\'. ';

// Ramps are ordered light -> dark: index 0 is the brightest cell.
export const RAMPS: Record<Exclude<AsciiCharset, 'custom'>, string> = {
	standard: ' .:-=+*#%@',
	detailed: [...CLASSIC_RAMP].reverse().join(''),
	minimal: ' .:*#',
	blocks: ' ░▒▓█',
	binary: ' #'
};

const QUADRANTS = [' ', '▘', '▝', '▀', '▖', '▌', '▞', '▛', '▗', '▚', '▐', '▜', '▄', '▙', '▟', '█'];

const BRAILLE_BASE = 0x2800;
// dot bit for [column][row] of the 2x4 braille cell
const BRAILLE_BITS = [
	[0x01, 0x02, 0x04, 0x40],
	[0x08, 0x10, 0x20, 0x80]
];

const BAYER_4 = [
	[0, 8, 2, 10],
	[12, 4, 14, 6],
	[3, 11, 1, 9],
	[15, 7, 13, 5]
];

export type AsciiParams = {
	mode: AsciiMode;
	charset: AsciiCharset;
	customRamp: string;
	invert: boolean;
	/** -100..100, same curve as the classic canvas contrast formula */
	contrast: number;
	/** -100..100 */
	brightness: number;
	/** 0..100, cut point for threshold / blocks / braille */
	threshold: number;
	/** 0..100, gradient magnitude needed before an edge char is drawn */
	edgeThreshold: number;
};

export const DEFAULT_ASCII_PARAMS: AsciiParams = {
	mode: 'luminance',
	charset: 'standard',
	customRamp: ' .:-=+*#%@',
	invert: false,
	contrast: 0,
	brightness: 0,
	threshold: 50,
	edgeThreshold: 20
};

export function resolveRamp(params: Pick<AsciiParams, 'charset' | 'customRamp'>): string {
	if (params.charset === 'custom') {
		return params.customRamp.length > 1 ? params.customRamp : RAMPS.standard;
	}
	return RAMPS[params.charset] ?? RAMPS.standard;
}

/**
 * Grid size that keeps the image aspect ratio once the non-square character
 * cell is taken into account. `charAspect` is charWidth / charHeight.
 */
export function fitGridSize(
	imageWidth: number,
	imageHeight: number,
	cols: number,
	charAspect: number
): { cols: number; rows: number } {
	const safeCols = Math.max(1, Math.round(cols));
	if (imageWidth <= 0 || imageHeight <= 0) return { cols: safeCols, rows: safeCols };
	const rows = Math.round((safeCols * imageHeight * charAspect) / imageWidth);
	return { cols: safeCols, rows: Math.max(1, rows) };
}

/**
 * Box-averaged luminance grid, normalized to 0..1 with brightness, contrast and
 * inversion already applied. Transparent pixels are composited over white so
 * cut-out images keep a clean background.
 */
export function sampleLuma(
	src: ImageSource,
	cols: number,
	rows: number,
	params: AsciiParams
): Float32Array {
	const out = new Float32Array(cols * rows);
	if (cols <= 0 || rows <= 0 || src.width <= 0 || src.height <= 0) return out;

	const contrastFactor = (259 * (params.contrast + 255)) / (255 * (259 - params.contrast));
	const brightnessOffset = (params.brightness / 100) * 255;

	for (let row = 0; row < rows; row++) {
		const y0 = Math.floor((row * src.height) / rows);
		const y1 = Math.max(y0 + 1, Math.floor(((row + 1) * src.height) / rows));

		for (let col = 0; col < cols; col++) {
			const x0 = Math.floor((col * src.width) / cols);
			const x1 = Math.max(x0 + 1, Math.floor(((col + 1) * src.width) / cols));

			let sum = 0;
			let count = 0;
			for (let y = y0; y < y1 && y < src.height; y++) {
				for (let x = x0; x < x1 && x < src.width; x++) {
					const idx = (y * src.width + x) * 4;
					const alpha = src.data[idx + 3] / 255;
					const r = src.data[idx] * alpha + 255 * (1 - alpha);
					const g = src.data[idx + 1] * alpha + 255 * (1 - alpha);
					const b = src.data[idx + 2] * alpha + 255 * (1 - alpha);
					sum += 0.299 * r + 0.587 * g + 0.114 * b;
					count++;
				}
			}

			let luma = count > 0 ? sum / count : 255;
			luma = contrastFactor * (luma - 128) + 128 + brightnessOffset;
			luma = Math.max(0, Math.min(255, luma)) / 255;
			if (params.invert) luma = 1 - luma;

			out[row * cols + col] = luma;
		}
	}

	return out;
}

function toLines(chars: string[], cols: number, rows: number): string {
	const lines: string[] = [];
	for (let row = 0; row < rows; row++) {
		lines.push(chars.slice(row * cols, row * cols + cols).join(''));
	}
	return lines.join('\n');
}

function rampChar(ramp: string, luma: number): string {
	const idx = Math.round((1 - luma) * (ramp.length - 1));
	return ramp[Math.max(0, Math.min(ramp.length - 1, idx))];
}

function renderLuminance(luma: Float32Array, cols: number, rows: number, ramp: string): string {
	const chars = new Array<string>(cols * rows);
	for (let i = 0; i < luma.length; i++) chars[i] = rampChar(ramp, luma[i]);
	return toLines(chars, cols, rows);
}

function renderThreshold(
	luma: Float32Array,
	cols: number,
	rows: number,
	ramp: string,
	threshold: number
): string {
	const dark = ramp[ramp.length - 1];
	const chars = new Array<string>(cols * rows);
	for (let i = 0; i < luma.length; i++) chars[i] = luma[i] < threshold ? dark : ' ';
	return toLines(chars, cols, rows);
}

function renderDither(luma: Float32Array, cols: number, rows: number, ramp: string): string {
	const levels = ramp.length - 1;
	const buffer = Float32Array.from(luma);
	const chars = new Array<string>(cols * rows);

	const spread = (index: number, error: number, factor: number) => {
		buffer[index] += (error * factor) / 16;
	};

	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const i = row * cols + col;
			const value = Math.max(0, Math.min(1, buffer[i]));
			const level = Math.round(value * levels);
			const quantized = level / levels;
			const error = value - quantized;

			chars[i] = ramp[ramp.length - 1 - level];

			if (col + 1 < cols) spread(i + 1, error, 7);
			if (row + 1 < rows) {
				if (col > 0) spread(i + cols - 1, error, 3);
				spread(i + cols, error, 5);
				if (col + 1 < cols) spread(i + cols + 1, error, 1);
			}
		}
	}

	return toLines(chars, cols, rows);
}

function renderOrdered(luma: Float32Array, cols: number, rows: number, ramp: string): string {
	const levels = ramp.length - 1;
	const chars = new Array<string>(cols * rows);

	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const i = row * cols + col;
			const bias = (BAYER_4[row % 4][col % 4] / 16 - 0.5) / levels;
			const value = Math.max(0, Math.min(1, luma[i] + bias));
			chars[i] = rampChar(ramp, value);
		}
	}

	return toLines(chars, cols, rows);
}

function renderEdges(
	luma: Float32Array,
	cols: number,
	rows: number,
	edgeThreshold: number
): string {
	const chars = new Array<string>(cols * rows).fill(' ');
	const at = (x: number, y: number) =>
		luma[Math.max(0, Math.min(rows - 1, y)) * cols + Math.max(0, Math.min(cols - 1, x))];

	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const tl = at(col - 1, row - 1);
			const tc = at(col, row - 1);
			const tr = at(col + 1, row - 1);
			const ml = at(col - 1, row);
			const mr = at(col + 1, row);
			const bl = at(col - 1, row + 1);
			const bc = at(col, row + 1);
			const br = at(col + 1, row + 1);

			const gx = tr + 2 * mr + br - (tl + 2 * ml + bl);
			const gy = bl + 2 * bc + br - (tl + 2 * tc + tr);
			const magnitude = Math.hypot(gx, gy) / 4;

			if (magnitude < edgeThreshold) continue;

			// gradient is perpendicular to the edge, so rotate by 90 degrees
			let angle = (Math.atan2(gy, gx) * 180) / Math.PI + 90;
			angle = ((angle % 180) + 180) % 180;

			if (angle < 22.5 || angle >= 157.5) chars[row * cols + col] = '-';
			else if (angle < 67.5) chars[row * cols + col] = '\\';
			else if (angle < 112.5) chars[row * cols + col] = '|';
			else chars[row * cols + col] = '/';
		}
	}

	return toLines(chars, cols, rows);
}

function renderBlocks(
	src: ImageSource,
	cols: number,
	rows: number,
	params: AsciiParams,
	threshold: number
): string {
	const sub = sampleLuma(src, cols * 2, rows * 2, params);
	const chars = new Array<string>(cols * rows);

	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const dot = (dx: number, dy: number) => (sub[(row * 2 + dy) * cols * 2 + col * 2 + dx] < threshold ? 1 : 0);
			const mask = dot(0, 0) | (dot(1, 0) << 1) | (dot(0, 1) << 2) | (dot(1, 1) << 3);
			chars[row * cols + col] = QUADRANTS[mask];
		}
	}

	return toLines(chars, cols, rows);
}

function renderBraille(
	src: ImageSource,
	cols: number,
	rows: number,
	params: AsciiParams,
	threshold: number
): string {
	const sub = sampleLuma(src, cols * 2, rows * 4, params);
	const chars = new Array<string>(cols * rows);

	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			let bits = 0;
			for (let dx = 0; dx < 2; dx++) {
				for (let dy = 0; dy < 4; dy++) {
					if (sub[(row * 4 + dy) * cols * 2 + col * 2 + dx] < threshold) {
						bits |= BRAILLE_BITS[dx][dy];
					}
				}
			}
			chars[row * cols + col] = bits === 0 ? ' ' : String.fromCharCode(BRAILLE_BASE + bits);
		}
	}

	return toLines(chars, cols, rows);
}

export function imageToAscii(
	src: ImageSource,
	cols: number,
	rows: number,
	params: AsciiParams
): string {
	const width = Math.max(1, Math.round(cols));
	const height = Math.max(1, Math.round(rows));
	const ramp = resolveRamp(params);
	const threshold = params.threshold / 100;

	if (params.mode === 'blocks') return renderBlocks(src, width, height, params, threshold);
	if (params.mode === 'braille') return renderBraille(src, width, height, params, threshold);

	const luma = sampleLuma(src, width, height, params);

	switch (params.mode) {
		case 'inverse': {
			const flipped = new Float32Array(luma.length);
			for (let i = 0; i < luma.length; i++) flipped[i] = 1 - luma[i];
			return renderLuminance(flipped, width, height, ramp);
		}
		case 'threshold':
			return renderThreshold(luma, width, height, ramp, threshold);
		case 'dither':
			return renderDither(luma, width, height, ramp);
		case 'ordered':
			return renderOrdered(luma, width, height, ramp);
		case 'edges':
			return renderEdges(luma, width, height, params.edgeThreshold / 100);
		default:
			return renderLuminance(luma, width, height, ramp);
	}
}
