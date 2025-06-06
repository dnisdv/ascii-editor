import { BaseTool } from '../tool';
import type { ITool } from '../tool';
import type { ILayersManager, ICamera, IRenderManager, ICanvas } from '@editor/types';
import type { CanvasKit, Paint, Canvas as WasmCanvas } from 'canvaskit-wasm';
import type { HistoryManager } from '@editor/history-manager';
import { RequireActiveLayerVisible } from '@editor/tool-requirements';
import type { CoreApi } from '@editor/core';

export class TextTool extends BaseTool implements ITool {
	readonly name = 'text';
	readonly icon = '/icons/text.svg';

	private layers: ILayersManager;
	private camera: ICamera;

	private canvasKit: CanvasKit;
	private skCanvas: WasmCanvas;

	private renderManager: IRenderManager;
	private historyManager: HistoryManager;

	private selectedCell: { x: number; y: number } | null = null;

	private paint: Paint;
	private selectCanvas: ICanvas;

	private historyBatchTransaction: string | null = null;

	private cursorBlinkState: boolean = true;
	private cursorBlinkInterval: number | null = null;

	constructor(coreApi: CoreApi) {
		super({
			hotkey: '<A-t>',
			bus: coreApi.getBusManager(),
			name: 'text',
			isVisible: true,
			config: {},
			coreApi,
			requirements: [RequireActiveLayerVisible(coreApi, 'text')]
		});

		const select = coreApi.getCanvases().select;
		const { canvasKit, skCanvas } = select;
		this.canvasKit = canvasKit;
		this.skCanvas = skCanvas;

		this.camera = coreApi.getCamera();
		this.layers = coreApi.getLayersManager();
		this.renderManager = this.coreApi.getRenderManager();
		this.historyManager = this.coreApi.getHistoryManager();
		this.selectCanvas = this.coreApi.getCanvases().select;

		const { primary } = this.coreApi.getConfig().getTheme();
		this.paint = new this.canvasKit.Paint();
		this.paint.setColor(this.canvasKit.Color4f(primary[0], primary[1], primary[2], 0.8));
		this.paint.setStyle(this.canvasKit.PaintStyle.Fill);
		this.paint.setAntiAlias(true);

		this.camera.on('change', () => this.drawCursorOverlay());

		this.historyManager.onBeforeUndo(() => {
			this.cursorBlinkState = false;
			this.commitCurrentBatch();
			this.selectedCell = null;
			this.clearCursorOverlay();
		});

		this.historyManager.onAfterUndo(() => this.coreApi.getRenderManager().requestRender());
		this.historyManager.onAfterRedo(() => this.coreApi.getRenderManager().requestRender());

		this.layers.on('layer::remove::before', () => {
			this.commitCurrentBatch();
			this.selectedCell = null;
			this.drawCursorOverlay();
		});

		this.layers.on('layers::active::change', () => {
			this.commitCurrentBatch();
			this.selectedCell = null;
			this.drawCursorOverlay();
		});
	}

	private canInteract(): boolean {
		if (!this.checkRequirements()) return false;
		return !!this.layers.getActiveLayer();
	}

	private clearCursorOverlay() {
		this.renderManager.requestRenderFn();
	}

	public onRequirementFailure(): void {
		super.onRequirementFailure();
		this.commitCurrentBatch();
		this.selectedCell = null;
		this.drawCursorOverlay();
	}

	public onRequirementSuccess(): void {
		super.onRequirementSuccess();
	}

	public activate(): void {
		super.activate();
		this.addMouseListeners();

		this.renderManager.register(
			'tool::text',
			'cursorOverlay',
			() => {
				if (!this.selectedCell || !this.cursorBlinkState) return;

				const { x, y } = this.selectedCell;
				const { startX, startY, endX, endY } = this.cellPositionToGlobalScreen(x, y);

				const rect = this.canvasKit.LTRBRect(startX, startY, endX, endY);
				this.skCanvas.drawRect(rect, this.paint);
			},
			this.selectCanvas
		);

		if (this.selectedCell) this.drawCursorOverlay();
		this.startCursorBlink();
	}

	public deactivate(): void {
		super.deactivate();
		this.renderManager.unregister('tool::text', 'cursorOverlay');
		this.stopCursorBlink();
		this.clearCursorOverlay();
		this.getEventApi().removeToolEvents();
		this.commitCurrentBatch();
		this.selectedCell = null;
	}

	private startCursorBlink(): void {
		this.stopCursorBlink();
		this.cursorBlinkState = true;
		this.cursorBlinkInterval = window.setInterval(() => {
			this.cursorBlinkState = !this.cursorBlinkState;
			if (this.selectedCell) {
				this.drawCursorOverlay();
			} else if (!this.selectedCell && !this.cursorBlinkState) {
				this.drawCursorOverlay();
			}
		}, 500);
	}

	private stopCursorBlink(): void {
		if (this.cursorBlinkInterval !== null) {
			clearInterval(this.cursorBlinkInterval);
			this.cursorBlinkInterval = null;
		}
		this.cursorBlinkState = true;
	}

	private addMouseListeners(): void {
		this.getEventApi().registerMouseDown('left', this.handleCanvasMouseDown.bind(this));
		this.getEventApi().registerKeyPress('<C-v>', this.handlePaste.bind(this));
		this.getEventApi().registerKeyPress(
			/^(?:<[CSM]?-?)?(?:[a-zA-Z0-9 !"#$%&'()*+,-./:;<=>?@[\\\]^_`{|}~]|Backspace|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Escape)>$/,
			this.handleKeyPress.bind(this)
		);
	}

	private handleCanvasMouseDown(event: MouseEvent): void {
		if (event.button !== 0) return;

		this.commitCurrentBatch();

		if (!this.canInteract()) {
			this.selectedCell = null;
			this.drawCursorOverlay();
			return;
		}
		this.layers.ensureLayer();

		const { x, y } = this.getCellPosFromMouseEvent(event);
		this.selectedCell = { x, y };

		this.stopCursorBlink();
		this.cursorBlinkState = true;
		this.drawCursorOverlay();
		this.startCursorBlink();
	}

	private commitCurrentBatch(): void {
		if (this.historyBatchTransaction) {
			this.historyManager.commitBatch(this.historyBatchTransaction);
			this.historyBatchTransaction = null;
		}
	}

	private ensureHistoryBatch(): void {
		if (!this.historyBatchTransaction) {
			this.historyBatchTransaction = this.historyManager.beginBatch();
		}
	}

	private handleKeyPress(event: KeyboardEvent): void {
		if (!this.canInteract()) return;

		if (event.key === 'Escape') {
			this.commitCurrentBatch();
			this.selectedCell = null;
			this.stopCursorBlink();
			this.clearCursorOverlay();
			this.startCursorBlink();
			event.preventDefault();
			return;
		}

		if (!this.selectedCell) return;

		this.stopCursorBlink();
		this.cursorBlinkState = true;

		let handled = false;
		if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
			this.handleTypeCharacter(event.key);
			handled = true;
		} else {
			switch (event.key) {
				case 'Backspace':
					this.handleBackspace();
					handled = true;
					break;
				case 'ArrowUp':
				case 'ArrowDown':
				case 'ArrowLeft':
				case 'ArrowRight':
					this.handleArrowKeys(event.key);
					handled = true;
					break;
			}
		}

		if (handled) {
			this.drawCursorOverlay();
			event.preventDefault();
		}
		this.startCursorBlink();
	}

	private handleTypeCharacter(char: string): void {
		if (!this.selectedCell) return;
		const activeLayer = this.layers.getActiveLayer();
		if (!activeLayer) return;

		this.ensureHistoryBatch();
		const { x, y } = this.selectedCell;
		const beforeChar = activeLayer.getChar(x, y);

		this.historyManager.applyAction(
			{
				targetId: `layer::${activeLayer.id}`,
				type: `layer::set_chars`,
				before: { x, y, char: beforeChar },
				after: { x, y, char: char }
			},
			{ batchId: String(this.historyBatchTransaction), applyAction: false }
		);

		activeLayer.setChar(x, y, char);
		this.selectedCell = { x: x + 1, y: y };
		this.coreApi.getRenderManager().requestRender();
	}

	private handleArrowKeys(key: string): void {
		if (!this.selectedCell) return;

		let { x, y } = this.selectedCell;
		switch (key) {
			case 'ArrowUp':
				y--;
				break;
			case 'ArrowDown':
				y++;
				break;
			case 'ArrowLeft':
				x--;
				break;
			case 'ArrowRight':
				x++;
				break;
		}
		this.selectedCell = { x, y };
	}

	private handleBackspace(): void {
		if (!this.selectedCell || !this.canInteract()) return;

		const activeLayer = this.layers.getActiveLayer();
		if (!activeLayer) return;

		this.ensureHistoryBatch();

		const { x: currentX, y: currentY } = this.selectedCell;

		const deleteAtX = currentX - 1;
		const deleteAtY = currentY;

		const charToDelete = activeLayer.getChar(deleteAtX, deleteAtY);

		this.historyManager.applyAction(
			{
				targetId: `layer::${activeLayer.id}`,
				type: `layer::set_chars`,
				before: { x: deleteAtX, y: deleteAtY, char: charToDelete || ' ' },
				after: { x: deleteAtX, y: deleteAtY, char: ' ' }
			},
			{ batchId: String(this.historyBatchTransaction), applyAction: false }
		);

		activeLayer.setChar(deleteAtX, deleteAtY, ' ');
		this.selectedCell = { x: deleteAtX, y: deleteAtY };
		this.coreApi.getRenderManager().requestRender();
	}

	private async handlePaste(): Promise<void> {
		if (!this.selectedCell || !this.canInteract()) return;

		const activeLayer = this.layers.getActiveLayer();
		if (!activeLayer) return;

		this.ensureHistoryBatch();

		try {
			const clipboardText = await navigator.clipboard.readText();
			if (!clipboardText) return;

			const { x: initialCursorX, y: initialCursorY } = this.selectedCell;
			let currentLineY = initialCursorY;
			let currentLineX = initialCursorX;

			const lines = clipboardText.split(/\r?\n/);

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (i > 0) {
					currentLineX = initialCursorX;
					currentLineY++;
				}
				for (let j = 0; j < line.length; j++) {
					const charToPaste = line[j];
					const pasteX = currentLineX + j;
					const pasteY = currentLineY;

					const beforeChar = activeLayer.getChar(pasteX, pasteY);
					this.historyManager.applyAction(
						{
							targetId: `layer::${activeLayer.id}`,
							type: `layer::set_chars`,
							before: { x: pasteX, y: pasteY, char: beforeChar },
							after: { x: pasteX, y: pasteY, char: charToPaste }
						},
						{ batchId: String(this.historyBatchTransaction), applyAction: false }
					);
					activeLayer.setChar(pasteX, pasteY, charToPaste);
				}
				if (i === lines.length - 1) {
					this.selectedCell = { x: currentLineX + line.length, y: currentLineY };
				}
			}
		} catch (err) {
			console.error('Failed to read clipboard:', err);
		} finally {
			this.commitCurrentBatch();
			this.coreApi.getRenderManager().requestRender();
			this.drawCursorOverlay();
		}
	}

	private drawCursorOverlay() {
		this.renderManager.requestRender();
	}

	private cellPositionToGlobalScreen(cellX: number, cellY: number) {
		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();
		const startWorldX = cellX * charWidth;
		const startWorldY = cellY * charHeight;
		const endWorldX = startWorldX + charWidth;
		const endWorldY = startWorldY + charHeight;

		const screenStart = this.camera.worldToScreen(startWorldX, startWorldY);
		const screenEnd = this.camera.worldToScreen(endWorldX, endWorldY);

		return {
			startX: screenStart.x,
			startY: screenStart.y,
			endX: screenEnd.x,
			endY: screenEnd.y
		};
	}

	private getCellPosFromMouseEvent(event: MouseEvent): { x: number; y: number } {
		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();
		const mousePos = this.camera.getMousePosition({ x: event.clientX, y: event.clientY });
		const worldPos = this.camera.screenToWorld(mousePos.x, mousePos.y);
		const x = Math.floor(worldPos.x / charWidth);
		const y = Math.floor(worldPos.y / charHeight);
		return { x, y };
	}
}
