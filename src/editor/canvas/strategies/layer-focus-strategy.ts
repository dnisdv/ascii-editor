import type { Paragraph, ParagraphStyle, Canvas as WasmCanvas, CanvasKit } from 'canvaskit-wasm';
import type { IAsciiRenderingStrategy } from './ascii-rendering-strategy';
import type { ICamera, ILayer, ILayersManager } from '@editor/types';
import type { Config } from '@editor/config';
import type { FontManager } from '@editor/font-manager';

export class AsciiRenderFocusStrategy implements IAsciiRenderingStrategy {
	public dispose(): void {}

	public render(
		canvasKit: CanvasKit,
		skCanvas: WasmCanvas,
		camera: ICamera,
		layersManager: ILayersManager,
		config: Config,
		fontManager: FontManager
	): void {
		const viewport = camera.getViewport();
		const activeLayerId = layersManager.getActiveLayerKey();

		const activeLayerComposition = activeLayerId
			? layersManager.getLayerComposition(activeLayerId)
			: [];
		const activeAndAssociatedIds = new Set(activeLayerComposition.map((l) => l.id));

		const visibleLayers = layersManager.getAllVisibleLayersSorted();

		for (const layer of visibleLayers) {
			const isActive = activeAndAssociatedIds.has(layer.id);
			this.drawLayer(layer, isActive, viewport, canvasKit, skCanvas, config, fontManager);
		}
	}

	private drawLayer(
		layer: ILayer,
		isActive: boolean,
		viewport: { left: number; top: number; right: number; bottom: number },
		canvasKit: CanvasKit,
		skCanvas: WasmCanvas,
		config: Config,
		fontManager: FontManager
	) {
		const {
			dimensions: { height: charHeight, width: charWidth }
		} = fontManager.getMetrics();
		const tileSize = config.tileSize;

		const visibleX = viewport.left / (charWidth * tileSize);
		const visibleY = viewport.top / (charHeight * tileSize);
		const visibleWidth = (viewport.right - viewport.left) / (charWidth * tileSize);
		const visibleHeight = (viewport.bottom - viewport.top) / (charHeight * tileSize);

		const visibleTiles = layer.tileMap.query(visibleX, visibleY, visibleWidth, visibleHeight);
		if (visibleTiles.length === 0) {
			return;
		}

		const style = this.createParagraphStyleForLayer(isActive, canvasKit, config);

		for (const tile of visibleTiles) {
			const tileData = tile.toString();
			if (!tileData || tileData.trim() === '') {
				continue;
			}

			const paragraph = this.createParagraphFromData(
				tileData,
				tileSize * charWidth,
				style,
				canvasKit,
				fontManager
			);

			const drawX = tile.x * tileSize * charWidth;
			const drawY = tile.y * tileSize * charHeight;

			skCanvas.drawParagraph(paragraph, drawX, drawY);
			paragraph.delete();
		}
	}

	private createParagraphStyleForLayer(
		isActive: boolean,
		canvasKit: CanvasKit,
		config: Config
	): ParagraphStyle {
		const { foreground } = config.getTheme();
		const opacity = isActive ? 1.0 : 0.5;

		return new canvasKit.ParagraphStyle({
			textStyle: {
				color: canvasKit.Color4f(foreground[0], foreground[1], foreground[2], opacity),
				fontSize: 18
			}
		});
	}

	private createParagraphFromData(
		tileData: string,
		width: number,
		style: ParagraphStyle,
		canvasKit: CanvasKit,
		fontManager: FontManager
	): Paragraph {
		const fontMgr = fontManager.getFontMgr();
		const builder = canvasKit.ParagraphBuilder.Make(style, fontMgr);
		builder.addText(tileData);
		const paragraph = builder.build();
		builder.delete();
		paragraph.layout(width + 1);
		return paragraph;
	}
}
