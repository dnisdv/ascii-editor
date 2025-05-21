import type { CoreApi } from "@editor/core.type";
import type { Rectangle, SingleSelectSession, SelectedContentEntity } from "../selection-session";
import type { ISessionCommand } from "./type";
import type { ILayer } from "@editor/types";

export class MoveByCommand implements ISessionCommand {
  constructor(
    private coreApi: CoreApi,
    private offset: { x: number; y: number; },
  ) { }

  public execute(session: SingleSelectSession): void {
    this.moveBy(session, this.offset.x || 0, this.offset.y || 0)
  }

  private _clearContentFromLayer(tile: SelectedContentEntity | null, layer: ILayer): void {
    if (!tile || !tile.region || !layer) return;
    const { region } = tile;
    layer.clearRegion(region.startX, region.startY, region.width, region.height);
  }

  private _drawContentOnLayer(tile: SelectedContentEntity, layer: ILayer): void {
    if (!tile || !layer) return;
    const { region, data } = tile;
    layer.setToRegion(region.startX, region.startY, data);
  }

  public moveBy(session: SingleSelectSession, offsetX: number, offsetY: number): void {
    if (!session.getBoundingBox()) {
      console.warn("Session: No content selected to move.");
      return;
    }

    const tempLayer = session.getTargetLayer();
    if (!tempLayer) {
      console.warn("Session: Cannot move content, no target layer available or accessible.");
      return;
    }

    const selectedContent = session.getSelectedContent()
    const selectedRegion = session.getBoundingBox()

    if (!selectedContent) return

    const newContent = {
      ...selectedContent,
      region: {
        ...selectedContent.region,
        startX: selectedContent.region.startX + offsetX,
        startY: selectedContent.region.startY + offsetY,
      }
    }
    session.updateSelectedContent(newContent)

    this._clearContentFromLayer(selectedContent, tempLayer);
    this._drawContentOnLayer(newContent, tempLayer);

    if (selectedRegion) {
      const { dimensions: { width: charWidth, height: charHeight } } = this.coreApi.getFontManager().getMetrics();
      const newWorldX = selectedRegion.startX + offsetX * charWidth;
      const newWorldY = selectedRegion.startY + offsetY * charHeight;
      const newBoundingBox: Rectangle = {
        startX: newWorldX,
        startY: newWorldY,
        width: selectedRegion.width,
        height: selectedRegion.height,
      };
      session.updateSelectedRegion(newBoundingBox);
    }
  }

}
