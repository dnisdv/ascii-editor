import { EventEmitter } from "@editor/event-emitter";
import { SELECT_STATE } from "./state.type";
import { findRectangleAreaInString } from "./boundaries";
import type { CoreApi } from "@editor/core.type";
import type { ICamera, IEventEmitter, ILayer } from "@editor/types";
import type { Tile } from "./selection-model";
import type { ISelectionSessionSnapshot } from "./select-session-manager";

export interface ISelectionSession extends IEventEmitter<SelectionEventMap> {
  id: string;
  state: SELECT_STATE;
  getBoundingBox(): BoxCoords;
  getSelectedContent(): Tile[];
  getSourceLayer(): ILayer | null;
  setSourceLayer(id: string): void;
  getTempLayer(): ILayer | null;
  setTempLayer(id: string): void;
  setState(newState: SELECT_STATE): void;
  selectAll(): void;
  rotate(degrees: number, center?: { cx: number; cy: number } | null): void;
  getRotationAngle(): number;
  setRotationAngle(angle: number): void;
  rotateLeft90(): void;
  rotateRight90(): void;
  selectArea(params: { startCellX: number; startCellY: number; width: number; height: number }): void;
  updateBoundingBox(updates: Partial<BoxCoords>): void;
  transformBoundingBox(callback: (box: BoxCoords) => BoxCoords): void;
  readSelectedArea(): void;
  setSelectedContent(content: Tile[], autoActivate?: boolean): void;
  move(data: { dx?: number; dy?: number }): void;
  cancel(): void;
  commit(layer?: ILayer): void;
  activateSelecting(): void;
  deactivateSelecting(): void;
  serialize(): ISelectionSessionSnapshot;
}

export type BoxCoords = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export type SelectionEventMap = {
  "session::update": { before: BoxCoords; after: BoxCoords };
  "session::rotated": { before: ISelectionSessionSnapshot; after: ISelectionSessionSnapshot };
  "session::moved": { before: Tile[]; after: Tile[] };
  "session::content-selected": { before: Tile[]; after: Tile[] };
};

export class SingleSelectionSession extends EventEmitter<SelectionEventMap> implements ISelectionSession {
  public id: string;
  public state = SELECT_STATE.IDLE;
  private rotationAngle = 0;
  private boundingBox: BoxCoords = { startX: 0, startY: 0, endX: 0, endY: 0 };
  private selectedContent: Tile[] = [];
  private tempLayerId = "";
  private sourceLayerId = "";
  private camera: ICamera;

  constructor(private coreApi: CoreApi) {
    super();
    this.camera = this.coreApi.getCamera();
    this.id = `selection-${Date.now()}`;
  }

  getSelectedContent(): Tile[] {
    return this.selectedContent;
  }

  getSourceLayer(): ILayer | null {
    return this.coreApi.getLayersManager().getLayer(this.sourceLayerId);
  }

  getTempLayer(): ILayer | null {
    return this.coreApi.getLayersManager().getTempLayer(this.tempLayerId);
  }

  setSourceLayer(id: string): void {
    this.sourceLayerId = id;
  }

  setTempLayer(id: string): void {
    this.tempLayerId = id;
  }

  getBoundingBox(): BoxCoords {
    return this.boundingBox;
  }

  commit(layer?: ILayer): void {
    const targetLayer = layer || this.getSourceLayer();
    const tempLayer = this.getTempLayer();
    if (!tempLayer || !targetLayer) return;
    this.selectedContent.forEach(({ worldRegion, data }) => {
      targetLayer.setToRegion(worldRegion.startX, worldRegion.startY, data);
    });
    this.coreApi.getLayersManager().removeTempLayer(this.tempLayerId);
    this.setState(SELECT_STATE.IDLE);
  }

  cancel(): void {
    this.setState(SELECT_STATE.IDLE);
    this.coreApi.getLayersManager().removeTempLayer(this.tempLayerId);
  }

  getRotationAngle(): number {
    return this.rotationAngle;
  }

  setRotationAngle(angle: number): void {
    this.rotationAngle = ((angle % 360) + 360) % 360;
    this.emitTransformUpdate();
  }

  private emitTransformUpdate(): void {
    this.emit("session::update", { before: { ...this.boundingBox }, after: { ...this.boundingBox } });
  }

  rotate(degrees: number, center?: { cx: number; cy: number } | null): void {
    if (!this.selectedContent.length) return;
    const tempLayer = this.getTempLayer();
    if (!tempLayer) return;
    const rotationCenter = center || this.calculateRotationCenter();
    if (!rotationCenter) return;
    const rotations = Math.round(degrees / 90);
    if (rotations === 0) return;
    const clockwise = rotations > 0;
    const rotationSteps = Math.abs(rotations);
    const beforeSnapshot = this.serialize();
    this.clearTiles(this.selectedContent, tempLayer);
    for (let i = 0; i < rotationSteps; i++) {
      this.selectedContent = this.selectedContent.map(tile =>
        rotateTile(tile, rotationCenter, clockwise)
      );
    }
    this.drawTiles(this.selectedContent, tempLayer);
    const first = this.selectedContent[0];
    if (first) {
      const { startX, startY, width, height } = first.worldRegion;
      const { dimensions: { width: charWidth, height: charHeight } } = this.coreApi.getFontManager().getMetrics();
      this.updateBoundingBox({
        startX: startX * charWidth,
        startY: startY * charHeight,
        endX: (startX + width) * charWidth,
        endY: (startY + height) * charHeight,
      });
    }
    this.setRotationAngle(this.rotationAngle + rotations * 90 * (clockwise ? 1 : -1));
    this.emit("session::rotated", { before: beforeSnapshot, after: this.serialize() });
  }

  private calculateRotationCenter(): { cx: number; cy: number } | null {
    if (this.selectedContent.length === 0) return null;
    const { startX, startY, width, height } = this.selectedContent[0].worldRegion;
    return { cx: startX + width / 2, cy: startY + height / 2 };
  }

  rotateLeft90(center?: { cx: number; cy: number }): void {
    this.rotate(-90, center);
  }

  rotateRight90(center?: { cx: number; cy: number }): void {
    this.rotate(90, center);
  }

  setState(newState: SELECT_STATE): void {
    const before = { ...this.boundingBox };
    this.state = newState;
    this.emit("session::update", { before, after: { ...this.boundingBox } });
  }

  updateBoundingBox(updates: Partial<BoxCoords>): void {
    const before = { ...this.boundingBox };
    this.boundingBox = { ...this.boundingBox, ...updates };
    this.emit("session::update", { before, after: { ...this.boundingBox } });
  }

  transformBoundingBox(callback: (box: BoxCoords) => BoxCoords): void {
    const before = { ...this.boundingBox };
    this.boundingBox = callback(this.boundingBox);
    this.emit("session::update", { before, after: { ...this.boundingBox } });
  }

  move({ dx = 0, dy = 0 }: { dx?: number; dy?: number }): void {
    const { dimensions: { width: charWidth, height: charHeight } } = this.coreApi.getFontManager().getMetrics();
    const tempLayer = this.getTempLayer();
    if (!tempLayer) return;
    const beforeTiles = [...this.selectedContent];
    this.clearTiles(beforeTiles, tempLayer);
    this.selectedContent = this.selectedContent.map(tile => ({
      ...tile,
      worldRegion: { ...tile.worldRegion, startX: tile.worldRegion.startX + dx, startY: tile.worldRegion.startY + dy },
    }));
    this.drawTiles(this.selectedContent, tempLayer);
    this.updateBoundingBox({
      startX: this.boundingBox.startX + dx * charWidth,
      startY: this.boundingBox.startY + dy * charHeight,
      endX: this.boundingBox.endX + dx * charWidth,
      endY: this.boundingBox.endY + dy * charHeight,
    });
    this.emit("session::moved", { before: beforeTiles, after: this.selectedContent });
  }

  selectAll(): void {
    const sourceLayer = this.getSourceLayer();
    if (!sourceLayer) return;
    const allTiles = sourceLayer.queryAllTiles();
    if (!allTiles.length) return;
    const tileSize = this.coreApi.getConfig().tileSize;
    const collected: Tile[] = [];
    for (const rawTile of allTiles) {
      const fullContent = rawTile.query(0, 0, tileSize, tileSize);
      const boundary = findRectangleAreaInString(fullContent);
      if (!boundary) continue;
      const croppedData = this.cropTileContent(fullContent, boundary);
      const [startXInTile, startYInTile] = boundary.start;
      const [endXInTile, endYInTile] = boundary.end;
      const width = endXInTile - startXInTile + 1;
      const height = endYInTile - startYInTile + 1;
      const startX = rawTile.x * tileSize + startXInTile;
      const startY = rawTile.y * tileSize + startYInTile;
      collected.push({ worldRegion: { startX, startY, width, height }, data: croppedData });
    }
    if (!collected.length) return;
    const combinedTile = combineTiles(collected);
    const { startX, startY, width, height } = combinedTile.worldRegion;
    this.updateBoundingBox({ startX, startY, endX: startX + width, endY: startY + height });
    this.setSelectedContent([combinedTile], true);
    this.clearSourceLayer();
  }

  selectArea({ startCellX, startCellY, width, height }: { startCellX: number; startCellY: number; width: number; height: number }): void {
    const worldStart = this.cellPositionToWorld(startCellX, startCellY);
    const worldEnd = this.cellPositionToWorld(startCellX + width, startCellY + height);
    this.updateBoundingBox({ startX: worldStart.x, startY: worldStart.y, endX: worldEnd.x, endY: worldEnd.y });
    this.readSelectedArea();
  }

  readSelectedArea(): void {
    const sourceLayer = this.getSourceLayer();
    if (!sourceLayer) return;
    const { startX, startY, endX, endY } = this.boundingBox;
    const screenA = this.camera.worldToScreen(startX, startY);
    const screenB = this.camera.worldToScreen(endX, endY);
    const xMin = Math.min(screenA.x, screenB.x);
    const yMin = Math.min(screenA.y, screenB.y);
    const xMax = Math.max(screenA.x, screenB.x);
    const yMax = Math.max(screenA.y, screenB.y);
    const startCell = this.getCellPos(xMin, yMin);
    const endCell = this.getCellPos(xMax, yMax);
    const tilesFound = this.mousePositionToTileMap(startCell.x, startCell.y, endCell.x - startCell.x, endCell.y - startCell.y);
    const tileContent = sourceLayer.tileMap.query(
      tilesFound.startCellX,
      tilesFound.startCellY,
      tilesFound.endCellX - tilesFound.startCellX,
      tilesFound.endCellY - tilesFound.startCellY
    );
    const collected: Tile[] = [];
    for (const tile of tileContent) {
      const from = this.cellPositionInsideTile(startCell.x, startCell.y, tile.x, tile.y);
      const to = this.cellPositionInsideTile(endCell.x, endCell.y, tile.x, tile.y);
      const slice = tile.query(from.x, from.y, to.x - from.x + 1, to.y - from.y + 1);
      const boundary = findRectangleAreaInString(slice);
      if (!boundary) continue;
      const cropped = this.cropTileContent(slice, boundary);
      const { start, end } = boundary;
      const boundaryStartX = from.x + start[0];
      const boundaryStartY = from.y + start[1];
      const w = end[0] - start[0] + 1;
      const h = end[1] - start[1] + 1;
      const { startX, startY } = this.tileCellPosToScreen(boundaryStartX, boundaryStartY, tile.x, tile.y);
      collected.push({ worldRegion: { startX, startY, width: w, height: h }, data: cropped });
    }
    if (!collected.length) return;
    this.setSelectedContent([combineTiles(collected)], true);
    this.clearSourceLayer();
  }

  activateSelecting(): void {
    this.setState(SELECT_STATE.SELECTED);
  }

  deactivateSelecting(): void {
    this.setState(SELECT_STATE.IDLE);
  }

  setSelectedContent(content: Tile[], autoActivate: boolean = false): void {
    const oldContent = [...this.selectedContent];
    this.selectedContent = content;
    const first = this.selectedContent[0];
    if (!first) return;
    const { startX, startY, width, height } = first.worldRegion;
    const worldStart = this.cellPositionToWorld(startX, startY);
    const worldEnd = this.cellPositionToWorld(startX + width, startY + height);
    const tempLayer = this.getTempLayer();
    if (!tempLayer) return;
    this.clearTiles(oldContent, tempLayer);
    this.updateBoundingBox({ startX: worldStart.x, startY: worldStart.y, endX: worldEnd.x, endY: worldEnd.y });
    this.drawTiles(this.selectedContent, tempLayer);
    if (autoActivate) this.activateSelecting();
    this.emit("session::content-selected", { before: oldContent, after: this.selectedContent });
  }

  private clearSourceLayer(): void {
    const layer = this.getSourceLayer();
    if (!layer) return;
    this.clearTiles(this.selectedContent, layer);
  }

  private getCellPos(screenX: number, screenY: number) {
    const { dimensions: { width: charWidth, height: charHeight } } = this.coreApi.getFontManager().getMetrics();
    const pos = this.camera.screenToWorld(screenX, screenY);
    return { x: Math.floor(pos.x / charWidth), y: Math.floor(pos.y / charHeight) };
  }

  private mousePositionToTileMap(x: number, y: number, w: number, h: number) {
    const size = this.coreApi.getConfig().tileSize;
    return {
      startCellX: Math.floor(x / size),
      startCellY: Math.floor(y / size),
      endCellX: Math.floor((x + w) / size),
      endCellY: Math.floor((y + h) / size),
    };
  }

  private cellPositionInsideTile(cx: number, cy: number, tx: number, ty: number) {
    const size = this.coreApi.getConfig().tileSize;
    return { x: Math.max(0, cx - tx * size), y: Math.max(0, cy - ty * size) };
  }

  private tileCellPosToScreen(cx: number, cy: number, tileX: number, tileY: number) {
    const size = this.coreApi.getConfig().tileSize;
    return { startX: cx + tileX * size, startY: cy + tileY * size };
  }

  private cropTileContent(full: string, boundary: { start: [number, number]; end: [number, number] }) {
    const rows = full.split("\n");
    const { start, end } = boundary;
    const extracted = rows.slice(start[1], end[1] + 1).map(row => row.slice(start[0], end[0] + 1));
    return extracted.join("\n");
  }

  private cellPositionToWorld(x: number, y: number) {
    const { dimensions: { width: charWidth, height: charHeight } } = this.coreApi.getFontManager().getMetrics();
    return { x: x * charWidth, y: y * charHeight };
  }

  private clearTiles(tiles: Tile[], layer: ILayer): void {
    tiles.forEach(({ worldRegion }) => {
      layer.clearRegion(worldRegion.startX, worldRegion.startY, worldRegion.width, worldRegion.height);
    });
  }

  private drawTiles(tiles: Tile[], layer: ILayer): void {
    tiles.forEach(({ worldRegion, data }) => {
      layer.setToRegion(worldRegion.startX, worldRegion.startY, data);
    });
  }

  serialize(): ISelectionSessionSnapshot {
    return {
      id: this.id,
      boundingBox: { ...this.boundingBox },
      selectedContent: [...this.selectedContent],
      tempLayerId: this.tempLayerId,
      sourceLayerId: this.sourceLayerId,
    };
  }

  public static fromSnapshot(coreApi: CoreApi, snapshot: ISelectionSessionSnapshot): SingleSelectionSession {
    const session = new SingleSelectionSession(coreApi);
    session.id = snapshot.id;
    session.state = SELECT_STATE.SELECTED;
    session.boundingBox = { ...snapshot.boundingBox };
    session.selectedContent = [...snapshot.selectedContent];
    session.tempLayerId = snapshot.tempLayerId;
    session.sourceLayerId = snapshot.sourceLayerId;
    let tempLayer = session.getTempLayer();
    if (!tempLayer) {
      const [id, layer] = coreApi.getLayersManager().addTempLayer();
      tempLayer = layer;
      session.setTempLayer(id);
    }
    session.selectedContent.forEach(({ worldRegion, data }) => {
      tempLayer.setToRegion(worldRegion.startX, worldRegion.startY, data);
    });
    return session;
  }
}

export function combineTiles(tiles: Tile[]): Tile {
  const minX = Math.min(...tiles.map(t => t.worldRegion.startX));
  const minY = Math.min(...tiles.map(t => t.worldRegion.startY));
  const maxX = Math.max(...tiles.map(t => t.worldRegion.startX + t.worldRegion.width));
  const maxY = Math.max(...tiles.map(t => t.worldRegion.startY + t.worldRegion.height));
  const combinedWidth = maxX - minX;
  const combinedHeight = maxY - minY;
  const canvas = Array.from({ length: combinedHeight }, () => Array.from({ length: combinedWidth }, () => " "));
  for (const tile of tiles) {
    const sx = tile.worldRegion.startX - minX;
    const sy = tile.worldRegion.startY - minY;
    const dataLines = tile.data.split("\n");
    dataLines.forEach((line, rowIdx) => {
      line.split("").forEach((ch, colIdx) => {
        if (canvas[sy + rowIdx] && canvas[sy + rowIdx][sx + colIdx] !== undefined) {
          canvas[sy + rowIdx][sx + colIdx] = ch;
        }
      });
    });
  }
  return { worldRegion: { startX: minX, startY: minY, width: combinedWidth, height: combinedHeight }, data: canvas.map(r => r.join("")).join("\n") };
}

export function rotateTile(tile: Tile, referenceCenter: { cx: number; cy: number }, clockwise: boolean): Tile {
  const { data, worldRegion } = tile;
  const rows = data.split("\n");
  const numRows = rows.length;
  const numCols = Math.max(...rows.map(row => row.length));
  const paddedRows = rows.map(row => row.padEnd(numCols, " "));
  const rotatedGrid: string[] = [];
  if (clockwise) {
    for (let col = 0; col < numCols; col++) {
      let newRow = "";
      for (let row = numRows - 1; row >= 0; row--) {
        newRow += paddedRows[row][col];
      }
      rotatedGrid.push(newRow);
    }
  } else {
    for (let col = numCols - 1; col >= 0; col--) {
      let newRow = "";
      for (let row = 0; row < numRows; row++) {
        newRow += paddedRows[row][col];
      }
      rotatedGrid.push(newRow);
    }
  }
  const newData = rotatedGrid.join("\n");
  const newWidth = worldRegion.height;
  const newHeight = worldRegion.width;
  const rotatedCenterX = worldRegion.startX + newWidth / 2;
  const rotatedCenterY = worldRegion.startY + newHeight / 2;
  const offsetX = referenceCenter.cx - rotatedCenterX;
  const offsetY = referenceCenter.cy - rotatedCenterY;
  const newWorldRegion = {
    startX: Math.round(worldRegion.startX + offsetX),
    startY: Math.round(worldRegion.startY + offsetY),
    width: newWidth,
    height: newHeight,
  };
  return { worldRegion: newWorldRegion, data: newData };
}


