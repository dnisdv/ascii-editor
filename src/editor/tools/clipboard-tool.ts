import { BaseTool } from '../tool';
import type { ICamera } from '@editor/types';
import type { SelectToolApi } from './select/select-tool';
import type { CoreApi } from '@editor/core';

export const CLIPBOARD_COPY_SUCCESS_CODE = 'CLIPBOARD_COPY_SUCCESS_CODE';
export const CLIPBOARD_COPY_ERROR_CODE = 'CLIPBOARD_COPY_ERROR_CODE';
export const CLIPBOARD_COPY_EMPTY_CODE = 'CLIPBOARD_COPY_EMPTY_CODE';

export type ClipboardToolApi = {
	copyText: (text: string) => void;
};

export class ClipboardTool extends BaseTool {
	private camera: ICamera;
	private mousePosition: { x: number; y: number } = { x: 0, y: 0 };

	constructor(protected coreApi: CoreApi) {
		super({
			bus: coreApi.getBusManager(),
			name: 'clipboard',
			isVisible: true,
			coreApi,
			config: {}
		});

		this.camera = coreApi.getCamera();
		this.activate();
	}

	activate(): void {
		super.activate();

		this.getEventApi().registerKeyPress('<C-c>', this.copyToClipboard.bind(this));
		this.getEventApi().registerKeyPress('<C-v>', this.pasteFromClipboard.bind(this));
		this.getEventApi().registerKeyPress('<C-x>', this.cutToClipboard.bind(this));

		this.getEventApi().registerMouseMove(this.trackMousePosition.bind(this));
	}

	deactivate(): void {
		super.deactivate();
	}

	cleanup(): void {
		this.getEventApi().removeToolEvents();
	}

	public getApi(): ClipboardToolApi {
		return {
			copyText: this.copyText.bind(this)
		};
	}

	public copyText(text: string): void {
		if (!text || text.trim() === '') {
			this.emitToolNotification(CLIPBOARD_COPY_EMPTY_CODE, 'Nothing to copy.', 'info');
			return;
		}

		navigator.clipboard
			.writeText(text)
			.then(() => {
				this.emitToolNotification(
					CLIPBOARD_COPY_SUCCESS_CODE,
					'Content copied to clipboard.',
					'success'
				);
			})
			.catch(() => {
				this.emitToolNotification(CLIPBOARD_COPY_ERROR_CODE, 'Failed to copy content.', 'error');
			});
	}

	private getCellPos(_x: number, _y: number) {
		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();
		const mousePos = this.camera.getMousePosition({ x: _x, y: _y });
		const pos = this.camera.screenToWorld(mousePos.x, mousePos.y);
		const x = Math.round(pos.x / charWidth);
		const y = Math.round(pos.y / charHeight);
		return { x, y };
	}

	private trackMousePosition(event: MouseEvent): void {
		this.mousePosition = { x: event.clientX, y: event.clientY };
	}

	private cutToClipboard() {
		const selectTool = this.coreApi.getToolManager().getToolApi<SelectToolApi>('select');
		if (!selectTool) return;

		const selectSession = selectTool.getActiveSession();

		if (!selectSession || selectSession?.isEmpty()) return;
		const { data } = selectSession.getSelectedContent()!;

		selectTool.cancelActiveSession();
		if (data && data.length > 0) {
			navigator.clipboard.writeText(data);
		}
		this.coreApi.getRenderManager().requestRender();
	}

	private copyToClipboard(): void {
		const selectTool = this.coreApi.getToolManager().getToolApi<SelectToolApi>('select');
		if (!selectTool) return;

		const selectSession = selectTool.getActiveSession();
		const selectedContent = selectSession?.getSelectedContent();

		if (!selectedContent || !selectedContent) return;
		const { data } = selectedContent;

		if (data && data.length > 0) {
			navigator.clipboard.writeText(data);
		}
	}

	private pasteFromClipboard(): void {
		try {
			navigator.clipboard.readText().then((text) => {
				const data = this.applyClipboardContent(text);
				if (!data) return;

				const { x, y, width, height } = data;
				const selectTool = this.coreApi.getToolManager().getToolApi<SelectToolApi>('select');
				const layer = this.coreApi.getLayersManager().getActiveLayer();
				if (!selectTool || !layer) return;

				selectTool.createSessionWithContent(
					{
						startX: x,
						startY: y,
						width,
						height
					},
					text,
					layer?.id || ''
				);

				this.coreApi.getToolManager().activateTool('select');
				this.coreApi.getRenderManager().requestRender();
			});
		} catch (error) {
			console.error('Failed to read from clipboard:', error);
		}
	}

	private applyClipboardContent(
		text: string
	): { x: number; y: number; width: number; height: number } | undefined {
		if (!text) return;

		const { x, y } = this.mousePosition;
		const { x: cellX, y: cellY } = this.getCellPos(x, y);

		const lines = text.split('\n');
		const width = Math.max(...lines.map((line) => line.length));
		const height = lines.length;
		return { x: cellX, y: cellY, width, height };
	}
}
