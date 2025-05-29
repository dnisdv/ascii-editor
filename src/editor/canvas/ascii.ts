import type { CanvasKit, Canvas as WasmCanvas, Surface, ParagraphStyle, Paragraph } from 'canvaskit-wasm';
import { Canvas } from './canvas';
import type { ICamera, ILayersManager, ITileModel } from '@editor/types';
import type { Config } from '@editor/config';
import type { FontManager } from '@editor/font-manager';

export type AsciiOptions = {
  canvas: HTMLCanvasElement,
  canvasKit: CanvasKit,
  surface: Surface,
  camera: ICamera,
  config: Config,
  fontManager: FontManager,
  layersManager: ILayersManager
}

export class Ascii extends Canvas {
  private camera: ICamera;
  private config: Config
  private fontManager: FontManager
  private layersManager: ILayersManager;

  private paragraphStyle!: ParagraphStyle;
  private paragraphs: Map<string, { data: string; paragraph: Paragraph }>;


  constructor({ canvas, canvasKit, surface, camera, config, layersManager, fontManager }: AsciiOptions) {
    super(canvas, canvasKit, surface);

    this.camera = camera
    this.config = config
    this.layersManager = layersManager
    this.fontManager = fontManager

    this.paragraphs = new Map();

    this.updateParagraphStyle();
  }

  public prepareForConfigChange(): void {
    this.clearParagraphCache();
    this.updateParagraphStyle();
  }

  public clearParagraphCache(): void {
    for (const entry of this.paragraphs.values()) {
      if (entry.paragraph && !entry.paragraph.isDeleted()) {
        entry.paragraph.delete();
      }
    }
    this.paragraphs.clear();
  }

  private updateParagraphStyle(): void {
    const { foreground } = this.config.getTheme();
    this.paragraphStyle = new this.canvasKit.ParagraphStyle({
      textStyle: {
        color: this.canvasKit.Color4f(foreground[0], foreground[1], foreground[2], foreground[3]),
        fontSize: 18,
      },
    });
  }

  private createParagraphFromData(tileData: string, width: number): Paragraph {
    const fontMgr = this.fontManager.getFontMgr();
    const builder = this.canvasKit.ParagraphBuilder.Make(this.paragraphStyle, fontMgr);
    builder.addText(tileData);
    const paragraph = builder.build();
    builder.delete();
    paragraph.layout(width + 1);
    return paragraph;
  }

  public getTileParagraph(tile: ITileModel, tileData: string, width: number) {
    const key = `${tile.x}_${tile.y}`;
    const cachedEntry = this.paragraphs.get(key);

    if (!cachedEntry || cachedEntry.data !== tileData) {
      if (cachedEntry) {
        cachedEntry.paragraph.delete();
        this.paragraphs.delete(key);
      }

      const newParagraph = this.createParagraphFromData(tileData, width);
      const newEntry = { data: tileData, paragraph: newParagraph };
      this.paragraphs.set(key, newEntry);
      return newEntry;
    }

    return cachedEntry;
  }

  private clearCanvas(canvas: WasmCanvas) {
    canvas.clear(this.canvasKit.TRANSPARENT);
  }

  private drawTile(coord: string, tileSize: number, charWidth: number, charHeight: number) {
    const [tileX, tileY] = coord.split(",").map(Number);
    const combinedTileData = this.layersManager.getCombinedTileData(tileX, tileY);

    const tileBoundary = {
      x: tileX * tileSize,
      y: tileY * tileSize,
      width: tileSize,
      height: tileSize,
    };

    const fakeTileModel: ITileModel = {
      x: tileX,
      y: tileY,
      toString: () => combinedTileData,
    } as ITileModel;

    const paragraphEntry = this.getTileParagraph(fakeTileModel, combinedTileData, tileBoundary.width * charWidth);
    const drawX = tileBoundary.x * charWidth;
    const drawY = tileBoundary.y * charHeight;

    if (paragraphEntry?.paragraph) {
      this.skCanvas.drawParagraph(paragraphEntry.paragraph, drawX, drawY);
    }
  }

  public render() {
    this.clearCanvas(this.skCanvas);

    const viewport = this.camera.getViewport();
    const range = {
      x: viewport.left,
      y: viewport.top,
      width: viewport.right - viewport.left,
      height: viewport.bottom - viewport.top,
    };

    const config = this.config;
    const { dimensions: { height: charHeight, width: charWidth } } = this.fontManager.getMetrics();
    const tileSize = config.tileSize;

    const visibleX = viewport.left / (charWidth * tileSize);
    const visibleY = viewport.top / (charHeight * tileSize);
    const visibleWidth = range.width / (charWidth * tileSize);
    const visibleHeight = range.height / (charHeight * tileSize);

    const visibleLayers = this.layersManager.getAllVisibleLayersSorted();
    const tileCoordsSet = new Set<string>();
    for (const layer of visibleLayers) {
      const visibleTiles = layer.tileMap.query(visibleX, visibleY, visibleWidth, visibleHeight);
      for (const tile of visibleTiles) {
        tileCoordsSet.add(`${tile.x},${tile.y}`);
      }
    }

    this.skCanvas.save();
    this.skCanvas.scale(this.camera.scale, this.camera.scale);
    this.skCanvas.translate(-this.camera.offsetX, -this.camera.offsetY);

    tileCoordsSet.forEach(coord => this.drawTile(coord, tileSize, charWidth, charHeight));

    this.skCanvas.restore();
    this.surface.flush();
  }
}

