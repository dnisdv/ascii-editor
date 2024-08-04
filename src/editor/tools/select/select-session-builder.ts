import type { CoreApi } from "@editor/core.type";
import { SingleSelectionSession, type ISelectionSession } from "./select-session";
import type { SelectionSessionManager } from "./select-session-manager";

export class SelectionSessionBuilder {
  private session: SingleSelectionSession;

  constructor(private coreApi: CoreApi, private manager: SelectionSessionManager) {
    this.session = new SingleSelectionSession(coreApi);
  }

  setTempLayerId(id: string): this {
    this.session.setTempLayer(id);
    return this;
  }

  setSourceLayerId(id: string): this {
    this.session.setSourceLayer(id);
    return this;
  }

  setBoundingBox(bounds: { startX: number; startY: number; endX: number; endY: number }): this {
    this.session.updateBoundingBox(bounds);
    return this;
  }

  build(): ISelectionSession {
    if (!this.session.getSourceLayer()) {
      const activeLayer = this.coreApi.getLayersManager().ensureLayer();
      this.setSourceLayerId(activeLayer?.id ?? activeLayer)
    }

    if (!this.session.getTempLayer()) {
      const [tempId] = this.coreApi.getLayersManager().addTempLayer();
      this.setTempLayerId(tempId)
    }

    this.manager.emit('session::start', { session: this.session });
    return this.session;
  }
}
