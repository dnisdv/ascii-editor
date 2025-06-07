import type { Paragraph, ParagraphStyle, Canvas as WasmCanvas, CanvasKit } from 'canvaskit-wasm';
import type { IAsciiRenderingStrategy } from './ascii-rendering-strategy';
import type { ICamera, ILayersManager, ITileModel } from '@editor/types';
import type { Config } from '@editor/config';
import type { FontManager } from '@editor/font-manager';

export class AsciiRenderDefaultStrategy implements IAsciiRenderingStrategy {
	private paragraphs: Map<string, { data: string; paragraph: Paragraph }>;
	private paragraphStyle: ParagraphStyle | null = null;

	constructor() {
		this.paragraphs = new Map();
	}

	public dispose(): void {
		this.clearParagraphCache();
	}

	private updateParagraphStyle(canvasKit: CanvasKit, config: Config): void {
		const { foreground } = config.getTheme();
		this.paragraphStyle = new canvasKit.ParagraphStyle({
			textStyle: {
				color: canvasKit.Color4f(foreground[0], foreground[1], foreground[2], foreground[3]),
				fontSize: 18
			}
		});
	}

	private clearParagraphCache(): void {
		for (const entry of this.paragraphs.values()) {
			if (entry.paragraph && !entry.paragraph.isDeleted()) {
				entry.paragraph.delete();
			}
		}
		this.paragraphs.clear();
	}

	private createParagraphFromData(
		tileData: string,
		width: number,
		canvasKit: CanvasKit,
		fontManager: FontManager
	): Paragraph {
		const fontMgr = fontManager.getFontMgr();
		const builder = canvasKit.ParagraphBuilder.Make(this.paragraphStyle!, fontMgr);
		builder.addText(tileData);
		const paragraph = builder.build();
		builder.delete();
		paragraph.layout(width + 1);
		return paragraph;
	}

	private getTileParagraph(
		tile: ITileModel,
		tileData: string,
		width: number,
		canvasKit: CanvasKit,
		fontManager: FontManager
	): { data: string; paragraph: Paragraph } {
		const key = `${tile.x}_${tile.y}`;
		const cachedEntry = this.paragraphs.get(key);

		if (!cachedEntry || cachedEntry.data !== tileData) {
			if (cachedEntry && !cachedEntry.paragraph.isDeleted()) {
				cachedEntry.paragraph.delete();
			}
			this.paragraphs.delete(key);

			const newParagraph = this.createParagraphFromData(tileData, width, canvasKit, fontManager);
			const newEntry = { data: tileData, paragraph: newParagraph };
			this.paragraphs.set(key, newEntry);
			return newEntry;
		}

		return cachedEntry;
	}

	private drawTile(
		coord: string,
		tileSize: number,
		charWidth: number,
		charHeight: number,
		skCanvas: WasmCanvas,
		layersManager: ILayersManager,
		canvasKit: CanvasKit,
		fontManager: FontManager
	) {
		const [tileX, tileY] = coord.split(',').map(Number);
		const combinedTileData = layersManager.getCombinedTileData(tileX, tileY);

		if (!combinedTileData || combinedTileData.trim() === '') {
			return;
		}

		const tileBoundary = {
			x: tileX * tileSize,
			y: tileY * tileSize,
			width: tileSize,
			height: tileSize
		};

		const fakeTileModel: ITileModel = {
			x: tileX,
			y: tileY,
			data: combinedTileData
		};

		const paragraphEntry = this.getTileParagraph(
			fakeTileModel,
			combinedTileData,
			tileBoundary.width * charWidth,
			canvasKit,
			fontManager
		);

		const drawX = tileBoundary.x * charWidth;
		const drawY = tileBoundary.y * charHeight;

		if (paragraphEntry?.paragraph && !paragraphEntry.paragraph.isDeleted()) {
			skCanvas.drawParagraph(paragraphEntry.paragraph, drawX, drawY);
		}
	}

	public render(
		canvasKit: CanvasKit,
		skCanvas: WasmCanvas,
		camera: ICamera,
		layersManager: ILayersManager,
		config: Config,
		fontManager: FontManager
	): void {
		this.updateParagraphStyle(canvasKit, config);

		const viewport = camera.getViewport();
		const {
			dimensions: { height: charHeight, width: charWidth }
		} = fontManager.getMetrics();
		const tileSize = config.tileSize;

		const visibleX = viewport.left / (charWidth * tileSize);
		const visibleY = viewport.top / (charHeight * tileSize);
		const visibleWidth = (viewport.right - viewport.left) / (charWidth * tileSize);
		const visibleHeight = (viewport.bottom - viewport.top) / (charHeight * tileSize);

		const visibleLayers = layersManager.getAllVisibleLayersSorted();
		const tileCoordsSet = new Set<string>();
		for (const layer of visibleLayers) {
			const visibleTiles = layer.tileMap.query(visibleX, visibleY, visibleWidth, visibleHeight);
			for (const tile of visibleTiles) {
				tileCoordsSet.add(`${tile.x},${tile.y}`);
			}
		}

		tileCoordsSet.forEach((coord) =>
			this.drawTile(
				coord,
				tileSize,
				charWidth,
				charHeight,
				skCanvas,
				layersManager,
				canvasKit,
				fontManager
			)
		);
		this.evictOffscreenParagraphs(tileCoordsSet);
	}

	private evictOffscreenParagraphs(visibleTileCoords: Set<string>): void {
		const cachedCoords = Array.from(this.paragraphs.keys());
		for (const coord of cachedCoords) {
			if (!visibleTileCoords.has(coord)) {
				const entry = this.paragraphs.get(coord);
				if (entry && !entry.paragraph.isDeleted()) {
					entry.paragraph.delete();
				}
				this.paragraphs.delete(coord);
			}
		}
	}
}
