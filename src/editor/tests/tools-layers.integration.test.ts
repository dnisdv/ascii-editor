import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Core, CoreApi } from '@editor/core';
import { createAppInstance } from '@editor/app';
import { BusManager } from '@editor/bus-manager';
import { BaseBusLayers } from '@editor/bus-layers';
import { BaseBusTools } from '@editor/bus-tools';
import { BaseBusNotification } from '@editor/bus-notification';
import { Camera } from '@editor/camera';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import type { FontManager } from '@editor/font-manager';
import type { HistoryManager } from '@editor/history-manager';
import { BaseTool, type ITool } from '@editor/tool';
import type { ILayersManager } from '@editor/types';

vi.mock('canvaskit-wasm', () => cvk);

export class FakeTool extends BaseTool implements ITool {
	constructor(protected coreApi: CoreApi) {
		super({
			bus: coreApi.getBusManager(),
			hotkey: '<A-v>',
			name: 'fakeTool1',
			isVisible: true,
			config: { option1: true },
			coreApi
		});
	}
	activate(): void {}
	deactivate(): void {}
	update(): void {}
}

export class FakeTool2 extends BaseTool implements ITool {
	constructor(protected coreApi: CoreApi) {
		super({
			bus: coreApi.getBusManager(),
			hotkey: '<A-b>',
			name: 'fakeTool2',
			isVisible: true,
			config: { option1: true },
			coreApi
		});
	}
	activate(): void {}
	deactivate(): void {}
	update(): void {}
}

describe('Layer Bus Contract Integration Test', () => {
	let core: Core;
	let busManager: BusManager;
	let historyManager: HistoryManager;
	let fontManager: FontManager;
	let busLayers: BaseBusLayers;
	let layersManager: ILayersManager;

	beforeEach(() => {
		busManager = new BusManager({
			layers: new BaseBusLayers(),
			tools: new BaseBusTools(),
			notifications: new BaseBusNotification()
		});

		const camera = new Camera(1200, 800);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const canvasKitInstance = cvk.CanvasKit as any;
		const appFontData = { buffer: new ArrayBuffer(8), family: '' };

		const gridEl = document.createElement('canvas');
		const selectCanvasElement = document.createElement('canvas');
		const asciiEl = document.createElement('canvas');

		const [_core] = createAppInstance({
			canvasKitInstance,
			gridCanvasElement: gridEl,
			selectCanvasElement,
			asciiCanvasElement: asciiEl,
			busManager,
			camera,
			font: appFontData
		});

		core = _core;
		historyManager = core.getHistoryManager();
		fontManager = core.getFontManager();
		busLayers = core.getBusManager().layers;
		layersManager = core.getLayersManager();

		vi.spyOn(fontManager, 'getMetrics').mockReturnValue({
			size: 18,
			dimensions: { width: 10, height: 18 },
			lineHeight: 22
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		historyManager.clear();
	});

	describe('Layer Creation Behavior', () => {
		it('direct call add a layer internaly should make it active, emit create/activate events', () => {
			const createListener = vi.fn();
			const activateListener = vi.fn();
			busLayers.on('layer::create::response', createListener);
			busLayers.on('layer::change_active::response', activateListener);

			const [newLayerId, newLayer] = layersManager.addLayer();

			expect(layersManager.getLayers().length).toBe(1);
			expect(layersManager.getLayer(newLayerId)?.id).toBe(newLayer.id);
			expect(layersManager.getActiveLayerKey()).toBe(newLayerId);

			expect(createListener).toHaveBeenCalledWith(
				expect.objectContaining({ id: newLayerId, name: newLayer.name })
			);
			expect(activateListener).toHaveBeenCalledWith({ id: newLayerId });
		});

		it('Bus Request: "layer::create::request" should create/activate a layer, emit responses', () => {
			const createListener = vi.fn();
			const activateListener = vi.fn();
			busLayers.on('layer::create::response', createListener);
			busLayers.on('layer::change_active::response', activateListener);

			busLayers.emit('layer::create::request');

			expect(layersManager.getLayers().length).toBe(1);
			const newLayer = layersManager.getActiveLayer();
			expect(newLayer).not.toBeNull();

			expect(createListener).toHaveBeenCalledWith(expect.objectContaining({ id: newLayer!.id }));
			expect(activateListener).toHaveBeenCalledWith({ id: newLayer!.id });
		});
	});

	describe('Layer Removal Behavior', () => {
		let l1Id: string, l2Id: string, l3Id: string;

		beforeEach(() => {
			[l1Id] = layersManager.addLayer();
			[l2Id] = layersManager.addLayer();
			[l3Id] = layersManager.addLayer();
		});

		afterEach(() => {
			layersManager.clearLayers();
		});

		it('direct removing an active layer should activate next neighbour with priority of top one, emit events', () => {
			layersManager.setActiveLayer(l2Id);
			const removeListener = vi.fn();
			const activateListener = vi.fn();
			busLayers.on('layer::remove::response', removeListener);
			busLayers.on('layer::change_active::response', activateListener);

			layersManager.removeLayer(l2Id);

			expect(layersManager.getLayer(l2Id)).toBeNull();
			expect(layersManager.getActiveLayerKey()).toBe(l3Id);

			expect(removeListener).toHaveBeenCalledWith({ id: l2Id });
			expect(activateListener).toHaveBeenCalledWith({ id: l3Id });
		});

		it('Bus Request: Removing a non-active layer via bus "layer::remove::request" should emit activate/remove events', () => {
			layersManager.setActiveLayer(l3Id);

			const removeListener = vi.fn();
			const activateListener = vi.fn();
			busLayers.on('layer::remove::response', removeListener);
			busLayers.on('layer::change_active::response', activateListener);

			busLayers.emit('layer::remove::request', { id: l1Id });

			expect(layersManager.getLayer(l1Id)).toBeNull();
			expect(layersManager.getActiveLayerKey()).toBe(l3Id);

			expect(removeListener).toHaveBeenCalledWith({ id: l1Id });

			// TODO: think about this
			expect(activateListener).toHaveBeenCalledWith({ id: l3Id });
		});

		it('Removing the only layer results in no active layer and appropriate events active=null, remove', () => {
			layersManager.removeLayer(l1Id);
			layersManager.removeLayer(l2Id);

			const removeListener = vi.fn();
			const activateListener = vi.fn();
			busLayers.on('layer::remove::response', removeListener);
			busLayers.on('layer::change_active::response', activateListener);

			layersManager.removeLayer(l3Id);

			expect(layersManager.getLayers().length).toBe(0);
			expect(layersManager.getActiveLayerKey()).toBeNull();

			expect(removeListener).toHaveBeenCalledWith({ id: l3Id });
			expect(activateListener).toHaveBeenCalledWith({ id: null });
		});

		// TODO: add errors if no error exist, when will be an good error system
		it('requesting removal of a non-existent layer via bus does not emit success or error events', () => {
			const removeSuccessListener = vi.fn();
			busLayers.on('layer::remove::response', removeSuccessListener);

			const nonExistentId = 'id-that-does-not-exist';
			const initialLayerCount = layersManager.getLayers().length;

			busLayers.emit('layer::remove::request', { id: nonExistentId });

			expect(layersManager.getLayers().length).toBe(initialLayerCount);
			expect(removeSuccessListener).not.toHaveBeenCalled();
		});
	});

	// TODO: add more test cases in future
});
