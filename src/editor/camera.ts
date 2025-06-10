import { EventEmitter } from './event-emitter';
import type { ICamera } from './types';
import { getPixelRatio } from './utils';

type CameraEvents = {
	change: ICamera;
};

export class Camera extends EventEmitter<CameraEvents> implements ICamera {
	public offsetX: number;
	public offsetY: number;
	public scale: number;
	public maxScale: number;
	public minScale: number;
	public width: number;
	public height: number;

	constructor(width: number, height: number) {
		super();

		const dpr = getPixelRatio();
		const BASE_MIN_ZOOM = 0.25;
		const BASE_MAX_ZOOM = 7;

		this.minScale = BASE_MIN_ZOOM * dpr;
		this.maxScale = BASE_MAX_ZOOM * dpr;
		this.scale = 1 * dpr;

		this.offsetX = 0;
		this.offsetY = 0;
		this.width = width;
		this.height = height;
		this._changed();
	}

	private _changed() {
		this.emit('change', this);
	}

	public worldToCssPixels(worldX: number, worldY: number): { y: number; x: number } {
		const physicalPos = this.worldToScreen(worldX, worldY);
		const dpr = this.getPixelRatio();
		return {
			x: physicalPos.x / dpr,
			y: physicalPos.y / dpr
		};
	}

	getPixelRatio() {
		return getPixelRatio();
	}

	scaleToPercentage(scale: number): number {
		return ((scale - this.minScale) / (this.maxScale - this.minScale)) * 700;
	}

	percentageToScale(percentage: number): number {
		return (percentage / 700) * (this.maxScale - this.minScale) + this.minScale;
	}

	getZoomPercentage(): number {
		return this.scaleToPercentage(this.scale);
	}

	zoomAtPercentage(percentage: number, offsetX: number, offsetY: number) {
		const newScale = this.percentageToScale(percentage);
		this.zoomAt(newScale, offsetX, offsetY);
	}

	zoomIn() {
		const centerX = this.width / 2;
		const centerY = this.height / 2;

		const worldCenterX = centerX / this.scale + this.offsetX;
		const worldCenterY = centerY / this.scale + this.offsetY;

		const newScale = Math.min(this.scale * 1.5, this.maxScale);

		this.offsetX = worldCenterX - centerX / newScale;
		this.offsetY = worldCenterY - centerY / newScale;
		this.scale = newScale;

		this._changed();
	}

	zoomOut() {
		const centerX = this.width / 2;
		const centerY = this.height / 2;

		const worldCenterX = centerX / this.scale + this.offsetX;
		const worldCenterY = centerY / this.scale + this.offsetY;

		const newScale = Math.max(this.scale / 1.5, this.minScale);

		this.offsetX = worldCenterX - centerX / newScale;
		this.offsetY = worldCenterY - centerY / newScale;
		this.scale = newScale;

		this._changed();
	}

	move(dx: number, dy: number) {
		this.offsetX += dx;
		this.offsetY += dy;
		this._changed();
	}

	zoomAt(scale: number, offsetX: number, offsetY: number) {
		this.scale = Math.max(this.minScale, Math.min(this.maxScale, scale));
		this.offsetX = offsetX;
		this.offsetY = offsetY;
		this._changed();
	}

	setDimensions(width: number, height: number) {
		const currentCenterX = this.offsetX + this.width / (2 * this.scale);
		const currentCenterY = this.offsetY + this.height / (2 * this.scale);

		this.width = width;
		this.height = height;

		this.offsetX = currentCenterX - width / (2 * this.scale);
		this.offsetY = currentCenterY - height / (2 * this.scale);

		this._changed();
	}

	getViewport() {
		return {
			left: this.offsetX,
			top: this.offsetY,
			right: this.offsetX + this.width / this.scale,
			bottom: this.offsetY + this.height / this.scale
		};
	}

	getMousePosition(pos: { x: number; y: number }) {
		const ratio = getPixelRatio();
		return { x: pos.x * ratio, y: pos.y * ratio };
	}

	screenToWorldRaw(x: number, y: number) {
		const ratio = getPixelRatio();
		return this.screenToWorld(x * ratio, y * ratio);
	}

	worldToScreenRaw(x: number, y: number) {
		const ratio = getPixelRatio();
		return this.worldToScreen(x * ratio, y * ratio);
	}

	screenToWorld(x: number, y: number): { x: number; y: number } {
		return {
			x: x / this.scale + this.offsetX,
			y: y / this.scale + this.offsetY
		};
	}

	worldToScreen(x: number, y: number): { x: number; y: number } {
		return {
			x: (x - this.offsetX) * this.scale,
			y: (y - this.offsetY) * this.scale
		};
	}

	getState(): { offsetX: number; offsetY: number; scale: number } {
		return {
			offsetX: this.offsetX,
			offsetY: this.offsetY,
			scale: this.scale
		};
	}

	fitToRect(left: number, top: number, right: number, bottom: number) {
		const contentWidth = right - left;
		const contentHeight = bottom - top;

		if (contentWidth <= 0 || contentHeight <= 0) return;

		const scaleX = this.width / contentWidth;
		const scaleY = this.height / contentHeight;
		let newScale = Math.min(scaleX, scaleY);

		newScale = Math.max(this.minScale, Math.min(this.maxScale, newScale));

		const centerX = (left + right) / 2;
		const centerY = (top + bottom) / 2;

		const newOffsetX = centerX - this.width / (2 * newScale);
		const newOffsetY = centerY - this.height / (2 * newScale);

		this.zoomAt(newScale, newOffsetX, newOffsetY);
	}

	setState(state: { offsetX: number; offsetY: number; scale: number }) {
		if (state.offsetX !== undefined && state.offsetY !== undefined && state.scale !== undefined) {
			this.offsetX = state.offsetX;
			this.offsetY = state.offsetY;
			this.scale = state.scale;
		}
	}
}
