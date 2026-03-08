import type { CanvasKit } from 'canvaskit-wasm';
import type { FontManager } from '@editor/font-manager';

export type CharPolicyContext = {
	canvasKit: CanvasKit;
	fontManager: FontManager;
};

export type SanitizeOptions = {
	widthTolerancePx?: number;
	widthMaxRatio?: number;
};

const DEFAULT_OPTIONS: Required<SanitizeOptions> = {
	widthTolerancePx: 0.5,
	widthMaxRatio: 1.1
};

const ALLOWED_RANGES: Array<[number, number]> = [
	[0x20, 0x7e],
	[0x2500, 0x257f],
	[0x2580, 0x259f]
];

const ZERO_WIDTH_SET = new Set([
	0x200b, // ZWSP
	0x200c, // ZWNJ
	0x200d, // ZWJ
	0xfeff // BOM/ZWNBSP
]);

function inAllowedRanges(cp: number): boolean {
	for (const [a, b] of ALLOWED_RANGES) {
		if (cp >= a && cp <= b) return true;
	}
	return false;
}

function isControlOrSurrogate(cp: number): boolean {
	if ((cp >= 0x00 && cp < 0x20) || cp === 0x7f || (cp >= 0x80 && cp <= 0x9f)) return true;
	if (cp >= 0xd800 && cp <= 0xdfff) return true;
	return false;
}

function isZeroWidthOrFormat(cp: number): boolean {
	if (ZERO_WIDTH_SET.has(cp)) return true;
	if (
		(cp >= 0x200e && cp <= 0x200f) ||
		(cp >= 0x202a && cp <= 0x202e) ||
		(cp >= 0x2060 && cp <= 0x206f)
	) {
		return true;
	}
	return false;
}

function hasCombiningMark(s: string): boolean {
	const combining = /\p{M}/u;
	return combining.test(s.normalize('NFC'));
}

let cachedKey: string | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedFont: any | null = null;

function getSkFont(ctx: CharPolicyContext) {
	const fontCfg = ctx.fontManager.getCurrentFont().getConfig();
	const key = `${fontCfg.family}|${ctx.fontManager.getMetrics().size}`;
	if (cachedKey === key && cachedFont) return cachedFont;

	const fmgr = ctx.fontManager.getFontMgr();
	const style = {
		weight: ctx.canvasKit.FontWeight?.Normal ?? 400,
		width: ctx.canvasKit.FontWidth?.Normal ?? 4,
		slant: ctx.canvasKit.FontSlant?.Upright ?? 0
	};

	const tf = fmgr.matchFamilyStyle(fontCfg.family, style);
	cachedFont = new ctx.canvasKit.Font(tf, ctx.fontManager.getMetrics().size);
	cachedKey = key;
	return cachedFont;
}

function measureGlyphWidth(ch: string, ctx: CharPolicyContext): number | null {
	try {
		const skFont = getSkFont(ctx);
		const gids = skFont.getGlyphIDs(ch);
		if (!gids || gids.length !== 1) return null;
		const widths = skFont.getGlyphWidths(gids);
		if (!widths || widths.length !== 1) return null;
		return widths[0] as number;
	} catch {
		return null;
	}
}

export function isAllowedSingleCellChar(
	char: string,
	ctx?: CharPolicyContext,
	opts?: SanitizeOptions
): boolean {
	if (!char) return false;
	if (char === '\n') return true;

	const codePoint = char.codePointAt(0)!;

	if (isControlOrSurrogate(codePoint)) return false;
	if (isZeroWidthOrFormat(codePoint)) return false;
	if (hasCombiningMark(char)) return false;

	if (!inAllowedRanges(codePoint)) return false;

	if (ctx) {
		const width = measureGlyphWidth(char, ctx);
		if (width != null) {
			const metrics = ctx.fontManager.getMetrics();
			const charWidth = metrics.dimensions.width;
			const { widthTolerancePx, widthMaxRatio } = { ...DEFAULT_OPTIONS, ...opts };
			if (width > charWidth * widthMaxRatio + widthTolerancePx) return false;
		}
	}

	return true;
}

export function sanitizeTextForPaste(
	input: string,
	ctx?: CharPolicyContext,
	opts?: SanitizeOptions
): string {
	if (!input) return '';
	let out = '';
	for (const ch of input) {
		if (ch === '\r') continue;
		if (ch === '\n') {
			out += ch;
			continue;
		}
		if (isAllowedSingleCellChar(ch, ctx, opts)) out += ch;
	}
	return out;
}

export function sanitizeCharForTyping(
	ch: string,
	ctx?: CharPolicyContext,
	opts?: SanitizeOptions
): string | null {
	return isAllowedSingleCellChar(ch, ctx, opts) ? ch : null;
}
