import type { IEventEmitter } from '../internal';

type CameraEvents = {
	change: ICamera;
};

export interface ICamera extends IEventEmitter<CameraEvents> {
	readonly offsetX: number;
	readonly offsetY: number;
	readonly scale: number;
	readonly maxScale: number;
	readonly minScale: number;
	readonly width: number;
	readonly height: number;

	zoomIn(): void;
	zoomOut(): void;
	move(dx: number, dy: number): void;
	zoomAt(scale: number, offsetX: number, offsetY: number): void;
	getViewport(): { left: number; top: number; right: number; bottom: number };
	screenToWorld(x: number, y: number): { x: number; y: number };
	worldToScreen(x: number, y: number): { x: number; y: number };

	scaleToPercentage(scale: number): number;
	percentageToScale(percentage: number): number;
	getZoomPercentage(): number;

	worldToCssPixels(x: number, y: number): { x: number; y: number };
	getMousePosition(pos: { x: number; y: number }): { x: number; y: number };
	getPixelRatio(): number;

	screenToWorldRaw(x: number, y: number): { x: number; y: number };
	worldToScreenRaw(x: number, y: number): { x: number; y: number };

	getZoomPercentage(): number;

	getState(): { offsetX: number; offsetY: number; scale: number };
	setState(state: { offsetX: number; offsetY: number; scale: number }): void;

	fitToRect(left: number, top: number, right: number, bottom: number): void;
}
