import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Core } from '@editor/core';
import { createAppInstance } from '@editor/app';
import { BusManager } from '@editor/bus-manager';
import { BaseBusLayers } from '@editor/bus-layers';
import { BaseBusTools } from '@editor/bus-tools';
import { BaseBusNotification } from '@editor/bus-notification';
import { Camera } from '@editor/camera';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { CameraControlTool } from './camera-control';

vi.mock('canvaskit-wasm', () => cvk);

const createMouseEvent = (
	type: 'mousedown' | 'mousemove' | 'mouseup' | 'mouseleave' | 'wheel',
	clientX: number,
	clientY: number,
	button?: number,
	deltaY?: number
): MouseEvent | WheelEvent => {
	if (type === 'wheel')
		return new WheelEvent(type, { clientX, clientY, deltaY, bubbles: true, cancelable: true });
	return new MouseEvent(type, { clientX, clientY, button, bubbles: true, cancelable: true });
};

describe('Camera Control Tool', () => {
	let core: Core;
	let cameraControlTool: CameraControlTool;
	let camera: Camera;
	let busManager: BusManager;
	let selectCanvasElement: HTMLCanvasElement;

	beforeEach(() => {
		busManager = new BusManager({
			layers: new BaseBusLayers(),
			tools: new BaseBusTools(),
			notifications: new BaseBusNotification()
		});

		camera = new Camera(1200, 1200);

		const [_core, _app] = createAppInstance({
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			canvasKitInstance: cvk.CanvasKit as any,
			gridCanvasElement: document.createElement('canvas'),
			selectCanvasElement: document.createElement('canvas'),
			asciiCanvasElement: document.createElement('canvas'),
			busManager: busManager,
			camera: camera,
			font: { buffer: new ArrayBuffer(8), family: '' }
		});

		core = _core;
		selectCanvasElement = core.getUI().getSelectCanvas().canvas;

		cameraControlTool = new CameraControlTool(core);
		_app.registerTool(cameraControlTool);

		const fontManager = core.getFontManager();
		vi.spyOn(fontManager, 'getMetrics').mockReturnValue({
			size: 18,
			dimensions: { width: 10, height: 18 },
			lineHeight: 22
		});
	});

	describe('Zooming Behaviors', () => {
		it('should zoom in the camera and request render', () => {
			const initialScale = camera.scale;
			cameraControlTool.zoomIn();
			expect(camera.scale).toBeGreaterThan(initialScale);
		});

		it('should zoom out the camera and request render on "zoom-decrement::request"', () => {
			const initialScale = camera.scale;
			cameraControlTool.zoomOut();
			expect(camera.scale).toBeLessThan(initialScale);
		});

		it('should zoom the camera to a specific percentage and request render on "zoom-change::request"', () => {
			const targetPercentage = 180;
			const initialScale = camera.scale;

			cameraControlTool.zoomToPercentage(targetPercentage);

			expect(camera.scale).not.toBe(initialScale);
			expect(camera.getZoomPercentage()).toBeCloseTo(targetPercentage, 0);
		});

		it('should adjust camera scale and request render on wheel events', () => {
			const initialScale = camera.scale;
			selectCanvasElement.dispatchEvent(createMouseEvent('wheel', 100, 100, undefined, 100));
			const afterZoomOutScale = camera.scale;
			expect(afterZoomOutScale).toBeLessThan(initialScale);

			selectCanvasElement.dispatchEvent(createMouseEvent('wheel', 100, 100, undefined, -100));
			expect(camera.scale).toBeGreaterThan(afterZoomOutScale);
		});
	});

	describe('Panning Behaviors', () => {
		it('should change camera offset and request render when dragging with the right mouse button', async () => {
			const initialOffsetX = camera.offsetX;
			const initialOffsetY = camera.offsetY;

			selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', 100, 100, 2));

			await new Promise((resolve) => requestAnimationFrame(resolve));
			window.dispatchEvent(createMouseEvent('mousemove', 150, 120, 2));
			await new Promise((resolve) => requestAnimationFrame(resolve));

			expect(camera.offsetX).not.toBe(initialOffsetX);
			expect(camera.offsetY).not.toBe(initialOffsetY);

			window.dispatchEvent(createMouseEvent('mouseup', 150, 120, 2));
		});

		it('should not pan if mouse moves without the right button being pressed', () => {
			const initialOffsetX = camera.offsetX;
			const initialOffsetY = camera.offsetY;
			window.dispatchEvent(createMouseEvent('mousemove', 150, 120, 0));
			expect(camera.offsetX).toBe(initialOffsetX);
			expect(camera.offsetY).toBe(initialOffsetY);
		});
	});

	describe('Fit to Content Behavior', () => {
		it('should adjust camera to fit visible content and request render on fit width', () => {
			const layer = core.getLayersManager().ensureLayer();
			layer.setChar(0, 0, 'X');
			layer.setChar(15, 8, 'Y');

			const initialCameraState = { ...camera.getState() };
			cameraControlTool.fitToContent();
			const finalCameraState = { ...camera.getState() };

			expect(finalCameraState.offsetX).not.toBe(initialCameraState.offsetX);
			expect(finalCameraState.offsetY).not.toBe(initialCameraState.offsetY);
			expect(finalCameraState.scale).not.toBe(initialCameraState.scale);
		});
	});
});
