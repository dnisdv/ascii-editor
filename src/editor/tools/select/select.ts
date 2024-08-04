import type { CanvasKit, Paint, Canvas as WasmCanvas } from 'canvaskit-wasm';
import { SELECT_STATE } from './state.type';
import type { CoreApi } from '@editor/core.type';
import {
  type ICamera,
  type ILayersManager,
  type ICanvas,
  type IRenderManager,
} from '@editor/types';
import type { SelectionSessionManager } from './select-session-manager';
import type { ISelectionSession } from './select-session';

export class Select {
  private camera: ICamera;
  private canvasKit: CanvasKit;
  private skCanvas: WasmCanvas;
  private paint: Paint;
  private animationID: number | undefined;

  private selectCanvas: ICanvas;
  private selectCanvasRenderManager: IRenderManager;
  private layers: ILayersManager;

  private activeSession: ISelectionSession | null = null;

  renderManagerSubscription: (() => void) | null = null

  constructor(private coreApi: CoreApi, private sessionManager: SelectionSessionManager) {
    this.camera = this.coreApi.getCamera();
    this.selectCanvas = this.coreApi.getCanvases().select;
    this.selectCanvasRenderManager = this.selectCanvas.getRenderManager();
    this.layers = this.coreApi.getLayersManager();

    const { canvasKit, skCanvas } = this.coreApi.getCanvases().select;
    this.canvasKit = canvasKit;
    this.skCanvas = skCanvas;

    const { primary } = this.coreApi.getConfig().getTheme();

    this.paint = new this.canvasKit.Paint();
    this.paint.setColor(this.canvasKit.Color4f(primary[0], primary[1], primary[2], primary[3]));
    this.paint.setStyle(this.canvasKit.PaintStyle.Stroke);
    this.paint.setAntiAlias(true);

    this.camera.on('change', () => {
      this.updateSelectionFromCamera()
    });

    this.sessionManager.on('session::start', ({ session }) => {
      this.activeSession = session;
      this.subscribeToSession(this.activeSession)
      this.selectCanvasRenderManager.requestRender('tool::select', 'select')
    })

    this.sessionManager.on('session::end', () => {
      this.activeSession = null;
    })
  }

  deactivate() {
    this.selectCanvasRenderManager.unregister('tool::select', 'select')
  }

  activate() {
    this.selectCanvasRenderManager.register('tool::select', 'select', () => {
      this.updateSelectionFromCamera();
    });
  }

  private subscribeToSession(session: ISelectionSession) {
    session.on('session::update', () => {
      this.selectCanvasRenderManager.requestRender('tool::select', 'select')
    })
  }

  private updateSelectionFromCamera(): void {
    if (!this.activeSession) return;

    if (this.activeSession.state === SELECT_STATE.SELECTING) {
      this.drawFrame();
    } else {
      const box = this.activeSession.getBoundingBox()

      this.drawSelectionOverlay({
        startX: box.startX,
        startY: box.startY,
        endX: box.endX,
        endY: box.endY
      });
    }
  }

  startSelection(pos: { x: number; y: number }): void {
    const worldPos = this.camera.screenToWorld(pos.x, pos.y);

    this.activeSession = this.sessionManager.createSessionBuilder()
      .setSourceLayerId(this.layers.ensureLayer().id)
      .setBoundingBox({
        startX: worldPos.x,
        startY: worldPos.y,
        endX: worldPos.x,
        endY: worldPos.y
      }).build()

    if (!this.activeSession) {
      throw Error('Selection area is not initialized');
    }

    this.activeSession.setState(SELECT_STATE.SELECTING)
    this.activeSession.updateBoundingBox({ startX: worldPos.x, startY: worldPos.y, endX: worldPos.x, endY: worldPos.y })
    this.selectCanvasRenderManager.requestRender('tool::select', 'select');
  }

  updateSelection(pos: { x: number; y: number }): void {
    const worldPos = this.camera.screenToWorld(pos.x, pos.y);

    if (!this.activeSession) {
      throw Error('Selection area is not initialized');
    }

    this.activeSession.updateBoundingBox({ endX: worldPos.x, endY: worldPos.y })
    this.selectCanvasRenderManager.requestRender('tool::select', 'select');
  }

  endSelection(): void {
    this.drawContentSelection();
    this.selectCanvasRenderManager.requestRender('tool::select', 'select_overlay');

    const session = this.sessionManager.getActiveSession()

    if (!session?.getSelectedContent()[0]) {
      this.removeSelection()
    }

    if (this.animationID) {
      cancelAnimationFrame(this.animationID);
      this.animationID = undefined;
    }
  }

  removeSelection(): void {
    if (this.animationID) {
      cancelAnimationFrame(this.animationID);
      this.animationID = undefined;
    }

    const activeSession = this.sessionManager.getActiveSession()
    this.selectCanvasRenderManager.requestRenderFn(() => {
      this.skCanvas.clear(this.canvasKit.TRANSPARENT);
    })

    this.selectCanvasRenderManager.requestRender('tool::select', 'select_overlay');
    this.selectCanvasRenderManager.requestRender('tool::select', 'select');

    if (activeSession) {
      if (this.sessionManager.isValidSession(activeSession)) {
        this.sessionManager.commit();
      } else {
        this.sessionManager.cancel();
      }
    }
  }

  drawFrame(): void {
    if (!this.activeSession) return;
    const { startX, startY, endX, endY } = this.activeSession.getBoundingBox();

    const screenStart = this.camera.worldToScreen(startX, startY);
    const screenEnd = this.camera.worldToScreen(endX, endY);

    const rect = this.canvasKit.LTRBRect(
      screenStart.x,
      screenStart.y,
      screenEnd.x,
      screenEnd.y
    );

    this.skCanvas.drawRect(rect, this.paint);
  }

  drawContentSelection(): void {
    const activeLayer = this.layers.getActiveLayer();
    const activeSession = this.sessionManager.getActiveSession()

    if (!activeLayer || !activeSession || !activeLayer.getOpts().visible) {
      return;
    }

    this.activeSession?.readSelectedArea()
  }

  private drawSelectionOverlay(selectedArea: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  }) {
    const activeSelectSession = this.sessionManager.getActiveSession();
    if (!activeSelectSession) return;

    this.skCanvas.clear(this.canvasKit.TRANSPARENT);

    const screenStart = this.camera.worldToScreen(selectedArea.startX, selectedArea.startY);
    const screenEnd = this.camera.worldToScreen(selectedArea.endX, selectedArea.endY);

    const rectCenterX = (screenStart.x + screenEnd.x) / 2;
    const rectCenterY = (screenStart.y + screenEnd.y) / 2;

    const rect = this.canvasKit.LTRBRect(screenStart.x, screenStart.y, screenEnd.x, screenEnd.y);

    this.skCanvas.save();
    this.skCanvas.translate(rectCenterX, rectCenterY);
    this.skCanvas.rotate(activeSelectSession.getRotationAngle(), 0, 0);
    this.skCanvas.translate(-rectCenterX, -rectCenterY);
    this.skCanvas.drawRect(rect, this.paint);
    this.skCanvas.restore();


    if (!activeSelectSession.getBoundingBox()) return;

    activeSelectSession.updateBoundingBox({
      startX: selectedArea.startX,
      startY: selectedArea.startY,
      endX: selectedArea.endX,
      endY: selectedArea.endY
    })
  }
}

