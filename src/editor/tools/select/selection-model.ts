import type { ICamera } from "@editor/types";
import type { CoreApi } from "@editor/core.type";

export interface WorldRegion {
  startX: number;
  startY: number;
  width: number;
  height: number;
}

export interface Tile {
  worldRegion: WorldRegion;
  data: string;
}

export class SelectionModel {
  camera: ICamera;

  tileSize: number;
  charWidth: number;
  charHeight: number

  constructor(private coreApi: CoreApi) {
    this.camera = this.coreApi.getCamera()
    this.tileSize = this.coreApi.getConfig().tileSize

    const { dimensions: { width: charWidth, height: charHeight } } = this.coreApi.getFontManager().getMetrics()

    this.charWidth = charWidth;
    this.charHeight = charHeight;
  }

  getCellPos(sx: number, sy: number) {
    const pos = this.camera.screenToWorld(sx, sy);
    const x = Math.floor(pos.x / this.charWidth);
    const y = Math.floor(pos.y / this.charHeight);
    return { x, y };
  }

  getTileByCellPos(x: number, y: number) {
    const tileX = Math.floor(x / this.tileSize);
    const tileY = Math.floor(y / this.tileSize);
    return { x: tileX, y: tileY }
  }

  mousePositionToTileMap(x: number, y: number, width: number, height: number) {
    const startCellX = Math.floor(x / this.tileSize);
    const startCellY = Math.floor(y / this.tileSize);
    const endCellX = Math.floor((x + width) / this.tileSize);
    const endCellY = Math.floor((y + height) / this.tileSize);

    return { startCellX, startCellY, endCellX, endCellY };
  }

  tileMapPositionToMouse(
    x: number,
    y: number,
    width: number,
    height: number,
    tileX: number,
    tileY: number
  ) {
    const startX =
      x * this.charWidth +
      this.tileSize * tileX * this.charWidth;
    const startY =
      y * this.charHeight +
      this.tileSize * tileY * this.charHeight;

    const endX = startX + width * this.charWidth;
    const endY = startY + height * this.charHeight;

    const screenStart = this.camera.worldToScreen(startX, startY);
    const screenEnd = this.camera.worldToScreen(endX, endY);

    return {
      startX: screenStart.x,
      startY: screenStart.y,
      endX: screenEnd.x,
      endY: screenEnd.y
    };
  }

  cellPositionInsideTile(x: number, y: number, tileX: number, tileY: number) {
    const relativeX = x - tileX * this.tileSize;
    const relativeY = y - tileY * this.tileSize;

    return { x: Math.max(0, relativeX), y: Math.max(0, relativeY) };
  }

  cellPositionToScreen(x: number, y: number) {
    const worldX = x * this.charWidth;
    const worldY = y * this.charHeight;
    const screenPos = this.camera.worldToScreen(worldX, worldY);
    return { x: screenPos.x, y: screenPos.y };
  }

  tileCellPosToScreen(_x: number, _y: number, tileX: number, tileY: number) {
    const x = _x + (tileX * this.tileSize);
    const y = _y + (tileY * this.tileSize);
    return { x, y }
  }

  tileCellPosToWorld(tileX: number, tileY: number, cellX: number, cellY: number) {
    const worldX = tileX * this.tileSize + cellX;
    const worldY = tileY * this.tileSize + cellY;
    return { x: worldX, y: worldY };
  }
}
