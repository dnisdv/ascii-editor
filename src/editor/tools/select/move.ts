import { SELECT_STATE } from "./state.type";
import type { CoreApi } from "@editor/core.type";
import type { ICamera } from "@editor/types";
import type { ISelectionSessionSnapshot, SelectionSessionManager } from "./select-session-manager";
import type { HistoryManager } from "@editor/history-manager";

export class MoveControl {
  private initialMousePos = { x: 0, y: 0 };
  private lastDeltaChars = { x: 0, y: 0 };
  private camera: ICamera;

  private sessionBefore: ISelectionSessionSnapshot | null = null
  private historyManager: HistoryManager

  constructor(
    private core: CoreApi,
    private selectionSessionManager: SelectionSessionManager
  ) {
    this.camera = this.core.getCamera();
    this.historyManager = this.core.getHistoryManager()
  }

  activate() { }
  deactivate() { }

  startMoving(pos: { x: number; y: number }): void {
    const worldPos = this.camera.screenToWorld(pos.x, pos.y);

    const activeSession = this.selectionSessionManager.getActiveSession()
    if (!activeSession) return;
    this.sessionBefore = this.selectionSessionManager.serializeActiveSession()

    activeSession?.setState(SELECT_STATE.MOVING)

    this.initialMousePos = worldPos;
    this.lastDeltaChars = { x: 0, y: 0 };
  }

  updateMoving(pos: { x: number; y: number }): void {
    const worldPos = this.camera.screenToWorld(pos.x, pos.y);
    const { dimensions: { width: charWidth, height: charHeight } } = this.core.getFontManager().getMetrics()

    const delta = {
      x: Math.round((worldPos.x - this.initialMousePos.x) / charWidth),
      y: Math.round((worldPos.y - this.initialMousePos.y) / charHeight),
    };

    if (delta.x !== this.lastDeltaChars.x || delta.y !== this.lastDeltaChars.y) {
      const increment = {
        x: delta.x - this.lastDeltaChars.x,
        y: delta.y - this.lastDeltaChars.y,
      };
      this.lastDeltaChars = delta;

      const activeSession = this.selectionSessionManager.getActiveSession()
      activeSession?.move({ dx: increment.x, dy: increment.y })
    }
  }

  endMoving(): void {
    const activeSession = this.selectionSessionManager.getActiveSession()
    activeSession?.setState(SELECT_STATE.SELECTED)

    this.historyManager.applyAction(
      {
        type: 'select::session_change',
        targetId: `select::session`,
        before: this.sessionBefore,
        after: this.selectionSessionManager.serializeActiveSession()
      }, { applyAction: false }
    );
  }

  isMouseInsideSelected(mouseX: number, mouseY: number): boolean {
    const activeSession = this.selectionSessionManager.getActiveSession()
    if (!activeSession) return false;

    const worldPos = this.camera.screenToWorld(mouseX, mouseY);
    const { startX, startY, endX, endY } = activeSession.getBoundingBox();

    return (
      worldPos.x >= startX &&
      worldPos.x <= endX &&
      worldPos.y >= startY &&
      worldPos.y <= endY
    );
  }
}
