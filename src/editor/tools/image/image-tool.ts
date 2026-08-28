import { BaseTool } from '@editor/tool';
import { RequireActiveLayerVisible } from '@editor/tool-requirements';
import { ImageAsciiObject } from './image-ascii-object';
import { decodeImageFile } from './image-source';
import { fitGridSize } from './image-to-ascii';

import type { ITool } from '@editor/tool';
import type { CoreApi } from '@editor/core';

export type ImageToolApi = {
	pickImage(): void;
};

const DEFAULT_COLS = 80;
const MAX_VIEWPORT_FILL = 0.8;

export class ImageTool extends BaseTool<ImageToolApi> implements ITool {
	readonly name = 'image';

	private input: HTMLInputElement | null = null;

	constructor(public readonly coreApi: CoreApi) {
		super({
			hotkey: '<A-i>',
			name: 'image',
			isVisible: true,
			coreApi,
			config: {},
			requirements: [RequireActiveLayerVisible(coreApi, 'image')]
		});
	}

	public activate(): void {
		super.activate();
		if (this.checkRequirements()) this.pickImage();
	}

	public deactivate(): void {
		super.deactivate();
		this.removeInput();
	}

	public cleanup(): void {
		this.removeInput();
	}

	public getApi(): ImageToolApi {
		return { pickImage: () => this.pickImage() };
	}

	public pickImage(): void {
		if (typeof document === 'undefined') return;

		this.removeInput();

		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.style.display = 'none';
		input.addEventListener('change', () => {
			const file = input.files?.[0];
			this.removeInput();
			if (file) void this.placeImage(file);
		});

		this.input = input;
		document.body.appendChild(input);
		input.click();
	}

	private removeInput(): void {
		this.input?.remove();
		this.input = null;
	}

	private async placeImage(file: Blob): Promise<void> {
		let decoded;
		try {
			decoded = await decodeImageFile(file);
		} catch {
			this.emitToolFeedback('IMAGE_DECODE_FAILED', 'Could not read that image', 'warning');
			return;
		}

		const { source, dataUrl } = decoded;
		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();
		const camera = this.coreApi.getCamera();
		const viewport = camera.getViewport();

		const viewportCols = Math.max(1, Math.floor((viewport.right - viewport.left) / charWidth));
		const cols = Math.max(4, Math.min(DEFAULT_COLS, Math.floor(viewportCols * MAX_VIEWPORT_FILL)));
		const grid = fitGridSize(source.width, source.height, cols, charWidth / charHeight);

		const centerCol = Math.floor((viewport.left + viewport.right) / 2 / charWidth);
		const centerRow = Math.floor((viewport.top + viewport.bottom) / 2 / charHeight);

		this.coreApi.getLayersManager().ensureLayer();

		const object = new ImageAsciiObject({
			cellX: centerCol - Math.floor(grid.cols / 2),
			cellY: centerRow - Math.floor(grid.rows / 2),
			width: grid.cols,
			height: grid.rows
		});
		object.setSource(source, dataUrl);

		this.coreApi.getSelectionManager().selectSmartObjects([object]);
	}
}
