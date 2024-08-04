import type { SelectionSessionManager } from "./select-session-manager";
import { SELECT_STATE } from "./state.type";
import type { CoreApi } from "@editor/core.type";
import type { ICamera, IRenderManager, ICanvas } from "@editor/types";

import type { Paint } from 'canvaskit-wasm';
import type { ISelectionSession } from "./select-session";

export class RotateControl {
  private initialAngle: number = 0;
  private cumulativeRotation: number = 0;
  private lastAngle: number = 0;

  private readonly cornerOffset: number = 5;
  private readonly hitArea: number = 20;

  private camera: ICamera;

  private selectCanvas: ICanvas
  private selectCanvasRenderManager: IRenderManager;

  private fixedCenter: { cx: number; cy: number } | null = null;

  private readonly dotRadius: number = 4;
  private readonly hoveredDotRadius: number = 6;
  private hoveredCorner: number | null = null;

  private paint: Paint;

  constructor(
    private coreApi: CoreApi,
    private sessionManager: SelectionSessionManager,
  ) {
    this.selectCanvas = this.coreApi.getCanvases().select;
    this.selectCanvasRenderManager = this.selectCanvas.getRenderManager()

    this.camera = this.coreApi.getCamera();
    const canvasKit = this.selectCanvas.canvasKit;

    const { primary } = this.coreApi.getConfig().getTheme();

    this.paint = new canvasKit.Paint();
    this.paint.setStyle(canvasKit.PaintStyle.Fill);
    this.paint.setColor(canvasKit.Color4f(primary[0], primary[1], primary[2], primary[3]));
    this.paint.setAntiAlias(true);

    this.camera.on('change', () => {
      this.selectCanvasRenderManager.requestRender('tool::select', "rotation_handles");
    });

    this.sessionManager.on('session::start', ({ session }) => {
      this.subscribeToSession(session)
    })
  }

  private subscribeToSession(session: ISelectionSession): void {
    session.on('session::update', () => {
      this.selectCanvasRenderManager.requestRender('tool::select', 'rotation_handles')
    })
  }

  activate() {
    this.selectCanvasRenderManager.register('tool::select', "rotation_handles", () => {
      this.drawRotationHandles();
    });
  }

  deactivate() {
    this.selectCanvasRenderManager.unregister('tool::select', "rotation_handles");
  }

  drawRotationHandles(): void {
    const activeSession = this.sessionManager.getActiveSession();
    if (!activeSession) return;

    const selectedContent = activeSession.getSelectedContent();
    if (selectedContent.length === 1 && selectedContent[0].data.trim().length === 1) return;

    if (activeSession.state === SELECT_STATE.ROTATING || activeSession.state === SELECT_STATE.SELECTED) {
      const { startX, startY, endX, endY } = activeSession.getBoundingBox();
      const rotationAngle = activeSession.getRotationAngle();

      const screenOffset = this.cornerOffset;
      const worldOffset = screenOffset;

      const offsetedStartX = startX - worldOffset;
      const offsetedStartY = startY - worldOffset;
      const offsetedEndX = endX + worldOffset;
      const offsetedEndY = endY + worldOffset;

      const corners = [
        { x: offsetedStartX, y: offsetedStartY },
        { x: offsetedEndX, y: offsetedEndY },
        { x: offsetedStartX, y: offsetedEndY },
        { x: offsetedEndX, y: offsetedStartY },
      ];

      const skCanvas = this.selectCanvas.skCanvas;

      const screenStart = this.camera.worldToScreen(startX, startY);
      const screenEnd = this.camera.worldToScreen(endX, endY);

      const rectCenterX = (screenStart.x + screenEnd.x) / 2;
      const rectCenterY = (screenStart.y + screenEnd.y) / 2;

      const pixelRatio = this.camera.getPixelRatio();

      const effectiveDotRadius = this.dotRadius * (Math.max(pixelRatio / 2, 1));
      const effectiveHoveredDotRadius = this.hoveredDotRadius * Math.max(pixelRatio / 2, 1);

      skCanvas.save();
      skCanvas.translate(rectCenterX, rectCenterY);
      skCanvas.rotate(rotationAngle, 0, 0);
      skCanvas.translate(-rectCenterX, -rectCenterY);

      if (activeSession.state === SELECT_STATE.ROTATING) {
        if (this.hoveredCorner !== null) {
          const corner = corners[this.hoveredCorner];
          const screenPos = this.camera.worldToScreen(corner.x, corner.y);
          skCanvas.drawCircle(screenPos.x, screenPos.y, effectiveHoveredDotRadius, this.paint);
        }
      } else {
        corners.forEach((corner, index) => {
          const screenPos = this.camera.worldToScreen(corner.x, corner.y);
          const radius = this.hoveredCorner === index ? effectiveHoveredDotRadius : effectiveDotRadius;
          skCanvas.drawCircle(screenPos.x, screenPos.y, radius, this.paint);
        });
      }

      skCanvas.restore();
    }
  }


  update() {
    this.initialAngle = 0
    this.lastAngle = this.initialAngle;
    this.cumulativeRotation = 0;
  }

  startRotation(pos: { x: number; y: number }): void {
    const activeSession = this.sessionManager.getActiveSession();
    if (!activeSession) return;

    const selectedContent = activeSession.getSelectedContent();
    if (selectedContent.length === 1 && selectedContent[0].data.trim().length === 1) return;

    const worldPos = this.camera.screenToWorld(pos.x, pos.y);

    activeSession.setState(SELECT_STATE.ROTATING)

    this.initialAngle = this.calculateAngle(worldPos);
    this.lastAngle = this.initialAngle;
    this.cumulativeRotation = 0;

    activeSession.setRotationAngle(this.cumulativeRotation);

    const selectedPoints = this.getSelectedContentToWorld();
    this.fixedCenter = this.computeCenter(selectedPoints);

    this.selectCanvasRenderManager.requestRender('tool::select', "rotation_handles");
  }

  private getSelectedContentToWorld(): { x: number; y: number; char: string }[] {
    const activeSession = this.sessionManager.getActiveSession();
    if (!activeSession) return [];

    const contentToWorld: { x: number; y: number; char: string }[] = [];

    const content = activeSession.getSelectedContent();
    content.forEach((content) => {
      const { data, worldRegion } = content;
      const rows = data.split('\n');

      rows.forEach((row, rowIndex) => {
        row.split('').forEach((char, colIndex) => {
          if (char.trim()) {
            contentToWorld.push({
              x: worldRegion.startX + colIndex,
              y: worldRegion.startY + rowIndex,
              char,
            });
          }
        });
      });
    });
    return contentToWorld;
  }

  endRotation(): void {
    const activeSession = this.sessionManager.getActiveSession();
    if (!activeSession) return;

    activeSession.setState(SELECT_STATE.SELECTED)
    this.cumulativeRotation = 0;
    activeSession.setRotationAngle(this.cumulativeRotation);

    this.fixedCenter = null;
  }

  updateRotation(pos: { x: number; y: number }): void {
    const activeSession = this.sessionManager.getActiveSession();
    if (!activeSession || activeSession.state !== SELECT_STATE.ROTATING) return;

    const worldPos = this.camera.screenToWorld(pos.x, pos.y);
    const currentAngle = this.calculateAngle(worldPos);


    this.coreApi.getCursor().setCursor('rotate', { angle: currentAngle });
    let angleDifference = currentAngle - this.lastAngle;
    if (angleDifference > 180) angleDifference -= 360;
    if (angleDifference < -180) angleDifference += 360;

    this.cumulativeRotation += angleDifference;
    this.lastAngle = currentAngle;

    activeSession.setRotationAngle(this.cumulativeRotation);
    const rotationThreshold = 90;

    if (Math.abs(this.cumulativeRotation) >= rotationThreshold) {
      const isClockwise = this.cumulativeRotation > 0;
      const rotationAngle = isClockwise ? 90 : -90;


      if (this.hoveredCorner !== null) {

        const cornerMap: { [x in number]: number } = isClockwise ? {
          0: 3,
          3: 1,
          1: 2,
          2: 0
        } : {
          0: 2,
          2: 1,
          1: 3,
          3: 0
        };

        this.hoveredCorner = cornerMap[this.hoveredCorner];
      }

      if (isClockwise) {
        this.cumulativeRotation -= rotationThreshold;
      } else {
        this.cumulativeRotation += rotationThreshold;
      }

      activeSession.rotate(rotationAngle, this.fixedCenter);

      this.initialAngle = currentAngle;
      this.lastAngle = currentAngle;
      this.selectCanvasRenderManager.requestRender('tool::select', "rotation_handles");
    }
  }

  public isMouseNearCorner(pos: { x: number; y: number }): boolean {
    const activeSession = this.sessionManager.getActiveSession();
    const selectedContent = activeSession?.getSelectedContent();

    if (!activeSession || (selectedContent && (selectedContent.length === 1 && selectedContent[0].data.trim().length === 1))) {
      this.hoveredCorner = null;
      return false;
    }

    const worldPos = this.camera.screenToWorld(pos.x, pos.y);
    const screenProximity = this.hitArea; // in screen pixels
    const worldProximity = screenProximity / this.camera.scale;

    const screenOffset = this.cornerOffset;
    const worldOffset = screenOffset;

    const { startX, startY, endX, endY } = activeSession.getBoundingBox();

    const offsetedStartX = startX - worldOffset;
    const offsetedStartY = startY - worldOffset;
    const offsetedEndX = endX + worldOffset;
    const offsetedEndY = endY + worldOffset;

    const corners = [
      { x: offsetedStartX, y: offsetedStartY },
      { x: offsetedEndX, y: offsetedEndY },
      { x: offsetedStartX, y: offsetedEndY },
      { x: offsetedEndX, y: offsetedStartY },
    ];

    const cx = (startX + endX) / 2;
    const cy = (startY + endY) / 2;
    const rotationAngle = activeSession.getRotationAngle();

    const rotatedCorners = corners.map(corner => {
      const dx = corner.x - cx;
      const dy = corner.y - cy;
      const angleRad = rotationAngle * (Math.PI / 180);
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      const rotatedX = dx * cos - dy * sin + cx;
      const rotatedY = dx * sin + dy * cos + cy;
      return { x: rotatedX, y: rotatedY };
    });

    let closestCornerIndex: number | null = null;
    let minDistanceSquared = Infinity;

    for (let i = 0; i < rotatedCorners.length; i++) {
      const corner = rotatedCorners[i];
      const dx = worldPos.x - corner.x;
      const dy = worldPos.y - corner.y;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared <= (worldProximity * worldProximity)) {
        if (distanceSquared < minDistanceSquared) {
          minDistanceSquared = distanceSquared;
          closestCornerIndex = i;
        }
      }
    }

    const previousHovered = this.hoveredCorner;
    this.hoveredCorner = closestCornerIndex;

    if (previousHovered !== this.hoveredCorner) {
      this.selectCanvasRenderManager.requestRender('tool::select', "rotation_handles");
    }

    if (this.hoveredCorner !== null) {
      const currentAngle = this.calculateAngle(worldPos);
      this.coreApi.getCursor().setCursor('rotate', { angle: currentAngle });
      return true;
    }

    return false;
  }

  cutTileContentByBoundary(tileContent: string, boundary: {
    start: [number, number];
    end: [number, number];
  }): string {
    const rows = tileContent.split('\n');

    const {
      start: [tileContentStartX, tileContentStartY],
      end: [tileContentEndX, tileContentEndY],
    } = boundary;

    const cutRows = rows
      .slice(tileContentStartY, tileContentEndY + 1)
      .map(row => row.slice(tileContentStartX, tileContentEndX + 1));

    return cutRows.join('\n');
  }

  private computeCenter(points: { x: number; y: number; char: string }[]): { cx: number; cy: number } {
    const xValues = points.map(p => p.x);
    const yValues = points.map(p => p.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const width = xMax - xMin + 1;
    const height = yMax - yMin + 1;
    const cx = width % 2 === 1 ? xMin + (width - 1) / 2 : xMin + width / 2 - 0.5;
    const cy = height % 2 === 1 ? yMin + (height - 1) / 2 : yMin + height / 2 - 0.5;

    this.fixedCenter = { cx, cy };
    return { cx, cy };
  };

  private calculateAngle(worldPos: { x: number; y: number }): number {
    const activeSession = this.sessionManager.getActiveSession();
    if (!activeSession) return 0;

    const { startX, startY, endX, endY } = activeSession.getBoundingBox()

    const centerX = startX + ((endX - startX) / 2);
    const centerY = startY + ((endY - startY) / 2);

    const deltaX = worldPos.x - centerX;
    const deltaY = worldPos.y - centerY;

    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    return angle < 0 ? angle + 360 : angle;
  }
}

