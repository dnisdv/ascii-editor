import type { CanvasKit, Paint, PaintStyle, Canvas as WasmCanvas } from 'canvaskit-wasm';

export const ANCHOR_BASE_SIZE = 8;

export interface AnchorStyle {
	fillPaint: Paint;
	strokePaint: Paint;
}

export function drawAnchor(
	canvasKit: CanvasKit,
	skCanvas: WasmCanvas,
	cx: number,
	cy: number,
	style: AnchorStyle,
	pixelRatio: number = 1
) {
	const size = ANCHOR_BASE_SIZE * Math.max(pixelRatio / 2, 1);
	const half = size / 2;
	const rect = canvasKit.LTRBRect(cx - half, cy - half, cx + half, cy + half);
	skCanvas.drawRect(rect, style.fillPaint);
	skCanvas.drawRect(rect, style.strokePaint);
}

export function createColor(canvasKit: CanvasKit, color: Float32Array | number[]) {
	return canvasKit.Color4f(color[0], color[1], color[2], color[3]);
}

export function createPaint(
	canvasKit: CanvasKit,
	color: Float32Array | number[],
	style: PaintStyle,
	strokeWidth?: number
): Paint {
	const paint = new canvasKit.Paint();
	paint.setColor(createColor(canvasKit, color));
	paint.setStyle(style);
	paint.setAntiAlias(true);
	if (strokeWidth !== undefined) {
		paint.setStrokeWidth(strokeWidth);
	}
	return paint;
}

export function drawRotationHandle(
	canvasKit: CanvasKit,
	skCanvas: WasmCanvas,
	cx: number,
	cy: number,
	style: AnchorStyle,
	pixelRatio: number = 1
) {
	const size = ANCHOR_BASE_SIZE * Math.max(pixelRatio / 2, 1);
	const half = size / 2;
	const oval = canvasKit.LTRBRect(cx - half, cy - half, cx + half, cy + half);
	skCanvas.drawOval(oval, style.fillPaint);
	skCanvas.drawOval(oval, style.strokePaint);
}

export function createFillPaint(canvasKit: CanvasKit, color: Float32Array | number[]): Paint {
	return createPaint(canvasKit, color, canvasKit.PaintStyle.Fill);
}

export function createStrokePaint(
	canvasKit: CanvasKit,
	color: Float32Array | number[],
	width: number = 1
): Paint {
	return createPaint(canvasKit, color, canvasKit.PaintStyle.Stroke, width);
}
