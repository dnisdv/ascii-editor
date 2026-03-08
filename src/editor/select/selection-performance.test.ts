import { describe, it, beforeEach, expect, vi } from 'vitest';
import { createAppInstance } from '@editor/app';
import { Camera } from '@editor/camera';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SelectionManager } from './selection-manager';
import type { Core } from '@editor/core';
import { SelectionMode } from './selection-mode';

vi.mock('canvaskit-wasm', () => cvk);

describe('Selection performance', () => {
	let core: Core;
	let selectionManager: SelectionManager;

	beforeEach(() => {
		const camera = new Camera(1600, 1200);
		const canvasKitInstance = cvk.CanvasKit;
		const appFontData = { buffer: new ArrayBuffer(8), family: 'PerfTest' };

		const [appCore] = createAppInstance({
			canvasKitInstance,
			gridCanvasElement: document.createElement('canvas'),
			selectCanvasElement: document.createElement('canvas'),
			asciiCanvasElement: document.createElement('canvas'),
			camera,
			font: appFontData
		});

		core = appCore;
		selectionManager = core.getSelectionManager();

		vi.spyOn(core.getFontManager(), 'getMetrics').mockReturnValue({
			size: 16,
			dimensions: { width: 8, height: 16 },
			lineHeight: 20
		});
	});

	function makeGridString(w: number, h: number, ch = 'A') {
		const line = ch.repeat(w);
		return Array.from({ length: h }, () => line).join('\n');
	}

	it('selects a 500x500 region in under 750ms', () => {
		const activeLayer = core.getLayersManager().ensureLayer();
		const W = 500;
		const H = 500;
		const content = makeGridString(W, H, '#');
		activeLayer.grid.setToRegion(0, 0, content);

		const t0 = globalThis.performance?.now?.() ?? Date.now();
		const ok = selectionManager.selectRegion(
			{ cellX: 0, cellY: 0, width: W, height: H },
			SelectionMode.SET
		);
		const t1 = globalThis.performance?.now?.() ?? Date.now();

		expect(ok).toBe(true);
		const dt = t1 - t0;
		expect(dt).toBeLessThan(750);

		const session = selectionManager.getActiveSession();
		expect(session && !session.isEmpty()).toBe(true);
		const obj = session!.getSelectedObjects()[0];
		expect(obj?.getProperty('transform.width')).toBe(W);
		expect(obj?.getProperty('transform.height')).toBe(H);
	});
});
