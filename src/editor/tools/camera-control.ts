import { BaseTool, type ITool } from '../tool';
import type { ICamera } from '@editor/types';
import type { CoreApi } from '@editor/core';

export class CameraControlTool extends BaseTool implements ITool {
	readonly visible = false;
	private camera: ICamera;

	private isDragging: boolean = false;
	private startX: number = 0;
	private startY: number = 0;
	private isRendering: boolean = false;

	constructor(coreApi: CoreApi) {
		super({
			bus: coreApi.getBusManager(),
			name: 'camera-control',
			isVisible: false,
			config: {},
			coreApi
		});

		this.camera = coreApi.getCamera();
		this.camera.on(
			'change',
			() => {
				const cameraState = this.camera.getState();
				this.saveConfig({ ...cameraState });
			},
			this
		);

		this.getEventApi().registerMouseDown('right', (e) => {
			this.handleMouseDown(e);
			this.getEventApi().registerMouseMove((e) => this.handleMouseMove(e));
			this.getEventApi().registerMouseUp(() => {
				this.handleMouseUp();
				this.getEventApi().unregisterMouseMove();
				this.getEventApi().unregisterMouseUp();
			});
		});
		this.getEventApi().registerWheel(this.handleWheelEvent.bind(this));
	}

	public activate(): void {}
	public deactivate(): void {}
	public cleanup(): void {}

	public zoomIn() {
		this.camera.zoomIn();
		this.coreApi.render();
	}

	public zoomOut() {
		this.camera.zoomOut();
		this.coreApi.render();
	}

	private findContentBoundsInTile(
		tileData: string
	): { minX: number; minY: number; maxX: number; maxY: number } | null {
		const lines = tileData.split('\n');
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;
		let contentFound = false;

		for (let y = 0; y < lines.length; y++) {
			const firstCharIndex = lines[y].search(/\S/);
			if (firstCharIndex !== -1) {
				contentFound = true;
				const lastCharIndex = lines[y].search(/\s*$/) - 1;
				minX = Math.min(minX, firstCharIndex);
				maxX = Math.max(maxX, lastCharIndex);
				minY = Math.min(minY, y);
				maxY = Math.max(maxY, y);
			}
		}

		if (!contentFound) return null;
		return { minX, minY, maxX, maxY };
	}

	public fitToContent(paddingPercentage: number = 0.1) {
		const visibleLayers = this.coreApi.getLayersManager().getAllVisibleLayers();
		if (visibleLayers.length === 0) return;

		let globalMinX = Infinity;
		let globalMinY = Infinity;
		let globalMaxX = -Infinity;
		let globalMaxY = -Infinity;
		let hasContent = false;

		const { tileSize } = this.coreApi.getConfig();

		for (const layer of visibleLayers) {
			for (const tile of layer.queryAllTiles()) {
				if (tile.isEmpty()) continue;

				const tileContentString = tile.toString();
				const bounds = this.findContentBoundsInTile(tileContentString);

				if (bounds) {
					hasContent = true;
					globalMinX = Math.min(globalMinX, tile.x * tileSize + bounds.minX);
					globalMinY = Math.min(globalMinY, tile.y * tileSize + bounds.minY);
					globalMaxX = Math.max(globalMaxX, tile.x * tileSize + bounds.maxX);
					globalMaxY = Math.max(globalMaxY, tile.y * tileSize + bounds.maxY);
				}
			}
		}

		if (!hasContent) return;

		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();

		const worldMinX = globalMinX * charWidth;
		const worldMinY = globalMinY * charHeight;
		const worldMaxX = (globalMaxX + 1) * charWidth;
		const worldMaxY = (globalMaxY + 1) * charHeight;

		const contentWidth = worldMaxX - worldMinX;
		const contentHeight = worldMaxY - worldMinY;

		const paddingX = contentWidth * paddingPercentage;
		const paddingY = contentHeight * paddingPercentage;

		this.camera.fitToRect(
			worldMinX - paddingX,
			worldMinY - paddingY,
			worldMaxX + paddingX,
			worldMaxY + paddingY
		);

		this.coreApi.render();
	}

	public zoomToPercentage(percentage: number) {
		const centerX = this.camera.width / 2;
		const centerY = this.camera.height / 2;

		const worldCenter = this.camera.screenToWorld(centerX, centerY);
		const newScale = this.camera.percentageToScale(percentage);

		this.camera.zoomAt(
			newScale,
			worldCenter.x - centerX / newScale,
			worldCenter.y - centerY / newScale
		);

		this.coreApi.render();
	}

	private handleMouseDown(event: MouseEvent): void {
		if (event.button === 1 || event.button === 2) {
			const { x: mouseX, y: mouseY } = this.camera.getMousePosition({
				x: event.clientX,
				y: event.clientY
			});
			this.isDragging = true;
			this.startX = mouseX;
			this.startY = mouseY;
		}
	}

	private handleMouseMove(event: MouseEvent): void {
		if (!this.isDragging) return;

		const { x: mouseX, y: mouseY } = this.camera.getMousePosition({
			x: event.clientX,
			y: event.clientY
		});
		event.preventDefault();

		const dx = (mouseX - this.startX) / this.camera.scale;
		const dy = (mouseY - this.startY) / this.camera.scale;

		this.startX = mouseX;
		this.startY = mouseY;
		this.camera.move(-dx, -dy);

		if (!this.isRendering) {
			this.isRendering = true;
			requestAnimationFrame(() => {
				this.coreApi.render();
				this.isRendering = false;
			});
		}
	}

	private handleMouseUp(): void {
		if (this.isDragging) {
			this.isDragging = false;
		}
	}

	private handleWheelEvent(event: WheelEvent): void {
		event.preventDefault();
		const { x: mouseX, y: mouseY } = this.camera.getMousePosition({
			x: event.clientX,
			y: event.clientY
		});

		const scaleMultiplier = event.deltaY < 0 ? 1.1 : 0.9;
		let newScale = this.camera.scale * scaleMultiplier;

		newScale = Math.max(this.camera.minScale, Math.min(this.camera.maxScale, newScale));

		const worldMouseX = mouseX / this.camera.scale + this.camera.offsetX;
		const worldMouseY = mouseY / this.camera.scale + this.camera.offsetY;

		this.camera.zoomAt(newScale, worldMouseX - mouseX / newScale, worldMouseY - mouseY / newScale);
		this.coreApi.render();
	}

	update(): void {
		this.camera.setState(this.config as { offsetX: number; offsetY: number; scale: number });
	}
}
