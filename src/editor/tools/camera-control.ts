import type { BaseBusTools } from '@editor/bus-tools';
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

	private toolsBus: BaseBusTools;

	constructor(coreApi: CoreApi) {
		super({
			bus: coreApi.getBusManager(),
			name: 'camera-control',
			isVisible: false,
			config: {},
			coreApi
		});

		this.toolsBus = coreApi.getBusManager().tools;

		this.toolsBus
			.withTool(this.name)
			.on('zoom-change::request', (data?: { percentage: number }) => {
				if (!data?.percentage) return;
				this.zoomToPercentage(data.percentage);
			});

		this.toolsBus.withTool(this.name).on('zoom-increment::request', () => {
			this.camera.zoomIn();
			this.coreApi.render();
		});

		this.toolsBus.withTool(this.name).on('zoom-decrement::request', () => {
			this.camera.zoomOut();
			this.coreApi.render();
		});

		this.camera = coreApi.getCamera();
		this.camera.on(
			'change',
			() => {
				this.toolsBus.withTool(this.name).emit('zoom-change::response', {
					zoom: this.camera.getZoomPercentage()
				});

				const cameraState = this.camera.getState();
				this.saveConfig({ ...cameraState });
			},
			this
		);

		this.toolsBus.withTool(this.name).on('fit-width::request', () => {
			this.fitToContent();
		});

		this.activate();
	}

	deactivate(): void {}
	cleanup(): void {}

	public fitToContent(paddingPercentage: number = 0.05) {
		const visibleLayers = this.coreApi.getLayersManager().getAllVisibleLayers();

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		const config = this.coreApi.getConfig();
		const { tileSize } = config;

		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();

		for (const layer of visibleLayers) {
			const tiles = layer.queryAllTiles();
			for (const tile of tiles) {
				const tileLeft = tile.x * tileSize * charWidth;
				const tileTop = tile.y * tileSize * charHeight;
				const tileRight = (tile.x + 1) * tileSize * charWidth;
				const tileBottom = (tile.y + 1) * tileSize * charHeight;

				minX = Math.min(minX, tileLeft);
				minY = Math.min(minY, tileTop);
				maxX = Math.max(maxX, tileRight);
				maxY = Math.max(maxY, tileBottom);
			}
		}

		if (minX === Infinity) return;

		const paddingX = (maxX - minX) * paddingPercentage;
		const paddingY = (maxY - minY) * paddingPercentage;
		minX -= paddingX;
		maxX += paddingX;
		minY -= paddingY;
		maxY += paddingY;

		this.camera.fitToRect(minX, minY, maxX, maxY);
		this.coreApi.render();
	}

	private zoomToPercentage(percentage: number) {
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

	activate(): void {
		this.getEventApi().registerMouseDown('right', this.handleMouseDown.bind(this));
		this.getEventApi().registerMouseMove(this.handleMouseMove.bind(this));
		this.getEventApi().registerMouseUp(this.handleMouseUp.bind(this));
		this.getEventApi().registerMouseLeave(this.handleMouseLeave.bind(this));
		this.getEventApi().registerWheel(this.handleWheelEvent.bind(this));
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

	private handleMouseLeave(): void {
		if (this.isDragging) {
			this.isDragging = false;
		}
	}

	private handleWheelEvent(event: WheelEvent): void {
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
