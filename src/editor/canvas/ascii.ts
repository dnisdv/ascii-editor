import type { CanvasKit, Canvas as WasmCanvas, Surface, ParagraphStyle, Paragraph, Paint } from 'canvaskit-wasm';
import type { CoreApi } from '@editor/core.type';
import { Canvas } from './canvas';
import type { ICamera, ITileModel } from '@editor/types';

export class Ascii extends Canvas {
  private camera: ICamera;
  private paragraphStyle!: ParagraphStyle;
  private paragraphs: Map<string, { data: string; paragraph: Paragraph }>;

  constructor(canvas: HTMLCanvasElement, canvasKit: CanvasKit, surface: Surface, private coreApi: CoreApi) {
    super(canvas, canvasKit, surface);

    this.camera = coreApi.getCamera();
    this.paragraphs = new Map();

    this.updateParagraphStyle();

    this.coreApi.getConfig().on('changed', () => {
      this.paragraphs.clear();
      this.updateParagraphStyle();
      this.render();
    });
  }

  private updateParagraphStyle(): void {
    const { foreground } = this.coreApi.getConfig().getTheme();
    this.paragraphStyle = new this.canvasKit.ParagraphStyle({
      textStyle: {
        color: this.canvasKit.Color4f(foreground[0], foreground[1], foreground[2], foreground[3]),
        fontSize: 18,
      },
    });
  }

  private createParagraphFromData(tileData: string, width: number): Paragraph {
    const fontMgr = this.coreApi.getFontManager().getFontMgr();
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
    const combinedTileData = this.coreApi.getLayersManager().getCombinedTileData(tileX, tileY);

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

    const config = this.coreApi.getConfig();
    const { dimensions: { height: charHeight, width: charWidth } } = this.coreApi.getFontManager().getMetrics();
    const tileSize = config.tileSize;

    const visibleX = viewport.left / (charWidth * tileSize);
    const visibleY = viewport.top / (charHeight * tileSize);
    const visibleWidth = range.width / (charWidth * tileSize);
    const visibleHeight = range.height / (charHeight * tileSize);

    const visibleLayers = this.coreApi.getLayersManager().getAllVisibleLayersSorted();
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

