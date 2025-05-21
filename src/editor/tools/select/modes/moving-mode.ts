import type { ICamera } from "@editor/types";
import { SelectionModeName, type ISelectionMode, type MovingModePayload } from "./modes.type";
import type { SelectionModeContext } from "./selection-mode-ctx";
import type { SelectionSessionManager } from "../session/selection-session-manager";
import type { CoreApi } from "@editor/core.type";
import { MoveByCommand } from "../session/commands/moveBy.cmd";
import type { SingleSessionSnapshot } from "../session/selection-session";
import type { HistoryManager } from "@editor/history-manager";

export class MovingMode implements ISelectionMode<SelectionModeName.MOVING> {
  readonly name = SelectionModeName.MOVING;

  private startPoint: { x: number; y: number } | null = null;
  private camera: ICamera;
  private historyManager: HistoryManager

  lastDeltaChars = { x: 0, y: 0 }
  initializedSession: SingleSessionSnapshot | null = null

  constructor(private coreApi: CoreApi, private selectionSessionManager: SelectionSessionManager) {
    this.camera = this.coreApi.getCamera()
    this.historyManager = this.coreApi.getHistoryManager()
  }

  getName(): string { return this.name; }

  onEnter(_: SelectionModeContext, payload: MovingModePayload): void {
    this.initializedSession = this.selectionSessionManager.serializeActiveSession()

    const { mouseDownEvent: { clientX, clientY } } = payload
    const pos = this.camera.getMousePosition({ x: clientX, y: clientY })
    this.startPoint = this.camera.screenToWorld(pos.x, pos.y)
  }

  onExit(): void { }
  handleMouseDown(): void { }

  handleMouseMove(event: MouseEvent) {
    if (!this.startPoint) return;

    const { clientX, clientY } = event
    const pos = this.camera.getMousePosition({ x: clientX, y: clientY })

    const worldPos = this.camera.screenToWorld(pos.x, pos.y);
    const { dimensions: { width: charWidth, height: charHeight } } = this.coreApi.getFontManager().getMetrics()

    const delta = {
      x: Math.round((worldPos.x - this.startPoint.x) / charWidth),
      y: Math.round((worldPos.y - this.startPoint.y) / charHeight),
    };

    if (delta.x !== this.lastDeltaChars.x || delta.y !== this.lastDeltaChars.y) {
      const increment = {
        x: delta.x - this.lastDeltaChars.x,
        y: delta.y - this.lastDeltaChars.y,
      };

      this.lastDeltaChars = delta;
      this.selectionSessionManager.executeCommandOnActiveSession(new MoveByCommand(this.coreApi, increment))
    }
  }

  handleMouseUp(_: MouseEvent, context: SelectionModeContext): void {
    const after = this.selectionSessionManager.serializeActiveSession()

    this.historyManager.applyAction(
      {
        type: 'select::session_change',
        targetId: `select::session`,
        before: this.initializedSession,
        after
      }, { applyAction: false }
    );

    this.lastDeltaChars = { x: 0, y: 0 }
    context.transitionTo(SelectionModeName.SELECTED)
  }
}

