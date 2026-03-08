import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClipboardManager } from './clipboard-manager';
import { SelectionManager } from '@editor/select/selection-manager';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import { FeedbackManager } from '@editor/feedback-manager';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import { FontManager } from '@editor/font-manager';
import { RectangleObject } from '@editor/tools/shape/rectangle-object';
import { LineObject } from '@editor/tools/shape/line-object';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { LayerSerializer } from '@editor/serializer';

vi.mock('canvaskit-wasm', () => cvk);

const createTestContext = () => {
	const config = new Config();
	const history = new HistoryManager();

	const smartObjectsManager = new SmartObjectsManager(config);
	const layerSerializer = new LayerSerializer(smartObjectsManager, config);

	const layers = new LayersManager({ config, historyManager: history, layerSerializer });
	layers.addLayer();

	const fontMgr = new FontManager(
		cvk.CanvasKit,
		{ buffer: new ArrayBuffer(8), family: 'mono' },
		{ size: 12 }
	);

	const smartObjects = new SmartObjectsManager(config);
	smartObjects.register('rectangle', RectangleObject);
	smartObjects.register('line', LineObject);

	const selection = new SelectionManager({
		layersManager: layers,
		fontManager: fontMgr,
		config,
		historyManager: history,
		smartObjectsManager: smartObjects
	});

	const feedback = new FeedbackManager();
	const clipboard = new ClipboardManager({
		selectionManager: selection,
		smartObjectsManager: smartObjects,
		layersManager: layers,
		historyManager: history,
		config,
		feedbackManager: feedback
	});

	return { clipboard, selection, smartObjects, layers, history, feedback };
};

const clipboardStore = { text: '' };
Object.assign(globalThis, {
	navigator: {
		clipboard: {
			writeText: async (t: string) => {
				clipboardStore.text = t;
			},
			readText: async () => clipboardStore.text
		}
	}
});

describe('ClipboardManager', () => {
	let ctx: ReturnType<typeof createTestContext>;

	beforeEach(() => {
		ctx = createTestContext();
		clipboardStore.text = '';
	});

	it('does nothing when copying with no selection', () => {
		ctx.clipboard.copy();
		expect(clipboardStore.text).toBe('');
	});

	it('copies simple text correctly', () => {
		const text = new TextSelectionObject({ cellX: 10, cellY: 5, width: 4, height: 1 }, 'ABCD');
		ctx.selection.selectSmartObjects([text]);

		ctx.clipboard.copy();

		expect(clipboardStore.text).toBe('ABCD');
	});

	it('preserves relative positions in plain text copy', () => {
		const obj1 = new TextSelectionObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'X');
		const obj2 = new TextSelectionObject({ cellX: 2, cellY: 1, width: 2, height: 1 }, 'YZ');

		ctx.selection.selectSmartObjects([obj1, obj2]);
		ctx.clipboard.copy();

		expect(clipboardStore.text).toBe('X   \n  YZ');
	});

	it('pastes rich objects with correct offsets', async () => {
		const o1 = new TextSelectionObject({ cellX: 3, cellY: 4, width: 3, height: 1 }, 'HEY');
		const o2 = new TextSelectionObject({ cellX: 5, cellY: 6, width: 2, height: 1 }, 'OK');

		ctx.selection.selectSmartObjects([o1, o2]);
		ctx.clipboard.copy();

		await ctx.clipboard.paste(100, 200);

		const pasted = ctx.selection.getActiveSession()!.getSelectedObjects();
		expect(pasted).toHaveLength(2);

		const minX = Math.min(o1.getProperty('transform.x'), o2.getProperty('transform.x'));
		const offset = 100 - minX;

		expect(pasted[0].getProperty('transform.x')).toBe(
			o1.getProperty<number>('transform.x') + offset
		);
		expect(pasted[1].getProperty('transform.x')).toBe(
			o2.getProperty<number>('transform.x') + offset
		);
		expect(pasted[0].id).not.toBe(o1.id);
	});

	it('falls back to plain text paste if rich data is missing', async () => {
		const obj = new TextSelectionObject({ cellX: 1, cellY: 2, width: 3, height: 1 }, 'TXT');
		ctx.selection.selectSmartObjects([obj]);
		ctx.clipboard.copy();

		ctx.clipboard['richClipboard'] = null;
		clipboardStore.text = 'TXT';

		await ctx.clipboard.paste(0, 0);

		const pasted = ctx.selection.getActiveSession()!.getSelectedObjects()[0] as TextSelectionObject;
		expect(pasted.selectedText).toBe('TXT');
		expect(pasted.getProperty('transform.x')).toBe(0);
	});

	it('handles overlapping objects by prioritizing later ones', () => {
		const bottom = new TextSelectionObject({ cellX: 0, cellY: 0, width: 3, height: 1 }, 'ABC');
		const top = new TextSelectionObject({ cellX: 1, cellY: 0, width: 2, height: 1 }, 'ZZ');

		ctx.selection.selectSmartObjects([bottom, top]);
		ctx.clipboard.copy();

		expect(clipboardStore.text).toBe('AZZ');
	});

	it('clears selection after cut', () => {
		const obj = new TextSelectionObject({ cellX: 0, cellY: 0, width: 2, height: 1 }, 'HI');
		ctx.selection.selectSmartObjects([obj]);

		ctx.clipboard.cut();

		expect(ctx.selection.getActiveSession()?.isEmpty() ?? true).toBe(true);
		expect(clipboardStore.text).toBe('HI');
	});

	it('formats multi-line objects correctly', () => {
		const m1 = new TextSelectionObject({ cellX: 1, cellY: 0, width: 3, height: 2 }, 'AA\nA ');
		const m2 = new TextSelectionObject({ cellX: 0, cellY: 1, width: 2, height: 2 }, 'B \nBB');

		ctx.selection.selectSmartObjects([m1, m2]);
		ctx.clipboard.copy();

		const expected = [' AA', 'BA ', 'BB '].join('\n');
		expect(clipboardStore.text).toBe(expected);
	});

	it('includes shapes in plain text copy', () => {
		const rect = new RectangleObject({ cellX: 0, cellY: 0, width: 4, height: 3 });
		const line = new LineObject({ cellX: 2, cellY: 1, width: 3, height: 1 });

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		ctx.selection.selectSmartObjects([rect as any, line as any]);
		ctx.clipboard.copy();

		const lines = clipboardStore.text.split('\n');
		expect(lines).toHaveLength(3);
		expect(lines[0][0]).toBe('┌');
		expect(lines[2][3]).toBe('┘');
	});

	it('decodes manually tagged rich payload', async () => {
		const obj = new TextSelectionObject({ cellX: 2, cellY: 3, width: 2, height: 1 }, 'Q1');
		ctx.selection.selectSmartObjects([obj]);
		ctx.clipboard.copy();

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const json = JSON.stringify((ctx.clipboard as any).richClipboard.payload);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(ctx.clipboard as any).richClipboard = null;

		clipboardStore.text = `__ASCII_RICH__:P:${json}`;

		await ctx.clipboard.paste(20, 30);

		const pasted = ctx.selection.getActiveSession()!.getSelectedObjects()[0];
		expect(pasted.getProperty('transform.x')).toBe(20);
		expect(pasted.getProperty('transform.y')).toBe(30);
	});

	it('generates new IDs on repeated pastes', async () => {
		const obj = new TextSelectionObject({ cellX: 0, cellY: 0, width: 2, height: 1 }, 'AZ');
		ctx.selection.selectSmartObjects([obj]);
		ctx.clipboard.copy();

		await ctx.clipboard.paste(0, 0);
		const firstIds = ctx.selection
			.getActiveSession()!
			.getSelectedObjects()
			.map((o) => o.id);

		await ctx.clipboard.paste(10, 10);
		const secondIds = ctx.selection
			.getActiveSession()!
			.getSelectedObjects()
			.map((o) => o.id);

		expect(secondIds[0]).not.toBe(firstIds[0]);
	});

	it('preserves trailing spaces', () => {
		const a = new TextSelectionObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
		const b = new TextSelectionObject({ cellX: 3, cellY: 0, width: 1, height: 1 }, 'B');

		ctx.selection.selectSmartObjects([a, b]);
		ctx.clipboard.copy();

		expect(clipboardStore.text).toBe('A  B');
		expect(clipboardStore.text).toHaveLength(4);
	});

	it('compresses large payloads', async () => {
		const writeMock = vi.fn();

		class MockClipboardItem {
			types: string[];
			data: Record<string, Blob>;

			constructor(items: Record<string, Blob>) {
				this.data = items;
				this.types = Object.keys(items);
			}

			getType(type: string) {
				return Promise.resolve(this.data[type]);
			}
		}

		const originalClipboardItem = globalThis.ClipboardItem;
		const originalWrite = globalThis.navigator.clipboard.write;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(globalThis as any).ClipboardItem = MockClipboardItem;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(globalThis.navigator.clipboard as any).write = writeMock;

		try {
			const largeText = 'A'.repeat(1000);
			const obj = new TextSelectionObject(
				{ cellX: 0, cellY: 0, width: 1000, height: 1 },
				largeText
			);
			ctx.selection.selectSmartObjects([obj]);

			ctx.clipboard.copy();

			expect(writeMock).toHaveBeenCalled();
			const item = writeMock.mock.calls[0][0][0];
			const blob = await item.getType('application/x-ascii-editor');

			const text = await blob.text();
			expect(text).toMatch(/^__ASCII_RICH__:C:/);
		} finally {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(globalThis as any).ClipboardItem = originalClipboardItem;
			if (originalWrite) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(globalThis.navigator.clipboard as any).write = originalWrite;
			} else {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				delete (globalThis.navigator.clipboard as any).write;
			}
		}
	});
});
