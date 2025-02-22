import { BaseTool } from '@editor/tool';
import { Select } from './select';
import { SELECT_STATE } from './state.type';
import { SelectionModel } from './selection-model';
import { RotateControl } from './rotate';
import { MoveControl } from './move';
import type { CoreApi } from '@editor/core.type';
import type { ILayersManager, ICamera } from '@editor/types';
import { SelectionSessionManager } from './select-session-manager';
import type { ISelectionSession } from './select-session';
import type { HistoryManager } from '@editor/history-manager';
import { SelectSessionChange } from './history/session-change';
import { SelectSession } from './history/session-select';
import { SelectSessionEnd } from './history/session-end';
import { RequireActiveLayerVisible } from '@editor/tool-requirements';
import { SelectSessionCancel } from './history/session-cancel';

export interface SelectToolApi {
  selectSession: SelectionSessionManager
}

export class SelectTool extends BaseTool {
  readonly name = 'select';

  select: Select;
  rotate: RotateControl;
  move: MoveControl;
  selectionModel: SelectionModel;

  private sessionManager: SelectionSessionManager;
  private layers: ILayersManager;
  private camera: ICamera;
  private historyManager: HistoryManager

  constructor(coreApi: CoreApi) {
    super({
      hotkey: '<A-v>',
      bus: coreApi.getBusManager(),
      coreApi,
      name: "select",
      isVisible: false,
      config: {},
      requirements: [
        RequireActiveLayerVisible(coreApi, 'select'),
      ]
    });

    this.layers = this.coreApi.getLayersManager();
    this.camera = this.coreApi.getCamera();

    this.sessionManager = new SelectionSessionManager(coreApi);
    this.selectionModel = new SelectionModel(coreApi);
    this.select = new Select(this.coreApi, this.sessionManager);
    this.rotate = new RotateControl(this.coreApi, this.sessionManager);
    this.move = new MoveControl(this.coreApi, this.sessionManager);

    this.layers.on('layers::active::change', () => {
      this.sessionManager.commit()
      this.select.removeSelection()
    })

    this.layers.on('layer::pre-remove', () => {
      this.sessionManager.commit()
    });

    this.layers.on('layer::updated', ({ before, after }) => {
      const isLayerVisibleChanged = before.opts?.visible !== after.opts?.visible

      if (isLayerVisibleChanged) {
        this.sessionManager.commit()
        this.select.removeSelection()
      }
    })

    this.historyManager = this.coreApi.getHistoryManager()
    this.historyManager.registerHandler('select::session_change', new SelectSessionChange());
    this.historyManager.registerHandler('select::session_select', new SelectSession());
    this.historyManager.registerHandler('select::session_end', new SelectSessionEnd());
    this.historyManager.registerHandler('select::session_cancel', new SelectSessionCancel());
    this.historyManager.registerTarget('select::session', this.sessionManager);

    this.sessionManager.on('session::content-selected', (session: ISelectionSession) => {
      const layer = session.getSourceLayer()
      if (!layer) throw new Error('Layer not found')

      const { worldRegion: { startX, startY, width, height } } = session.getSelectedContent()[0]
      const beforeRegion = layer.readRegion(startX, startY, width, height)

      this.historyManager.applyAction(
        {
          type: 'select::session_select',
          targetId: `select::session`,
          before: {
            session: null,
            data: beforeRegion,
          },
          after: {
            session: this.sessionManager.serializeSession(session)
          }
        }, { applyAction: false }
      );
    })

    this.sessionManager.on('session::commit', ({ session }) => {
      const layer = session.getSourceLayer()
      if (!layer) throw new Error('Layer not found')

      const { worldRegion: { startX, startY, width, height } } = session.getSelectedContent()[0]
      const beforeRegion = layer.readRegion(startX, startY, width, height)

      this.historyManager.applyAction(
        {
          type: 'select::session_end',
          targetId: `select::session`,
          before: {
            session: this.sessionManager.serializeSession(session),
            data: beforeRegion,
          },
          after: {
            session: null
          }
        }, { applyAction: false }
      );
    })

    this.sessionManager.on('session::rotated', ({ before, after }) => {
      this.historyManager.applyAction(
        {
          type: 'select::session_change',
          targetId: `select::session`,
          before,
          after
        }, { applyAction: false }
      );
    })

    this.sessionManager.on('session::destroy', ({ session }) => {
      const layer = session.getSourceLayer()
      this.coreApi.render()

      if (!layer) return;

      const { worldRegion: { startX, startY, width, height } } = session.getSelectedContent()[0]
      const beforeRegion = layer.readRegion(startX, startY, width, height)

      this.historyManager.applyAction(
        {
          type: 'select::session_cancel',
          targetId: `select::session`,
          before: {
            session: this.sessionManager.serializeSession(session),
            data: beforeRegion,
          },
          after: {
            session: null
          }
        }, { applyAction: false }
      );
    })

  }

  onRequirementFailure(): void {
    super.onRequirementFailure()
    this.sessionManager.commit()
  }

  onRequirementSuccess(): void {
    super.onRequirementSuccess()
  }

  activate(): void {
    super.activate()

    this.addMouseListeners();
    this.initKeyListener();

    this.select.activate()
    this.rotate.activate()
    this.move.activate()
  }

  deactivate(): void {
    super.deactivate()

    this.getEventApi().removeToolEvents()

    this.select.deactivate()
    this.rotate.deactivate()
    this.move.deactivate()

    this.sessionManager.commit()
  }

  cleanup(): void {
  }

  getApi(): SelectToolApi {
    return {
      selectSession: this.sessionManager
    };
  }

  private handleUnloadPage() {
    this.sessionManager.commit()
  }

  private handleSelectAll() {
    this.selectAll();
  }

  private handleDeleteSelected() {
    if (!this.sessionManager.getActiveSession() || this.sessionManager.getActiveSession()?.state !== SELECT_STATE.SELECTED) return;

    this.sessionManager.destroy()
    this.coreApi.render()
  }

  private initKeyListener(): void {
    this.getEventApi().registerKeyPress('<C-a>', this.handleSelectAll.bind(this));
    this.getEventApi().registerUnload(this.handleUnloadPage.bind(this));

    this.getEventApi().registerKeyPress('<Backspace>', this.handleDeleteSelected.bind(this));
    this.getEventApi().registerKeyPress('<Delete>', this.handleDeleteSelected.bind(this));
  }

  private addMouseListeners(): void {
    this.getEventApi().registerMouseDown('left', this.handleMouseDown.bind(this));
    this.getEventApi().registerMouseMove(this.handleMouseMove.bind(this));
    this.getEventApi().registerMouseUp(this.handleMouseUp.bind(this));
  }

  private selectAll() {
    const layer = this.layers.getActiveLayer()
    if (!layer) return;

    const session = this.sessionManager.createSessionBuilder().build()

    session.selectAll()
    session.activateSelecting()
  }

  private handleMouseDown(event: MouseEvent): void | false {
    this.layers.ensureLayer();
    this.checkRequirements()

    const pos = this.camera.getMousePosition({ x: event.clientX, y: event.clientY })
    const activeSession = this.sessionManager.getActiveSession()

    switch (activeSession?.state || null) {

      case SELECT_STATE.SELECTED:
        if (event.ctrlKey) {
          this.select.startSelection(pos);
          return;
        }

        if (this.rotate.isMouseNearCorner(pos)) {
          this.rotate.startRotation(pos);
          return
        } else if (this.move.isMouseInsideSelected(pos.x, pos.y)) {
          this.move.startMoving(pos);
          return
        } else {
          this.select.startSelection(pos);
          return
        }
      default:
        this.select.startSelection(pos);
        break;
    }

    return false;
  }

  private handleMouseMove(event: MouseEvent): void | false {
    const pos = this.camera.getMousePosition({ x: event.clientX, y: event.clientY })
    const activeSession = this.sessionManager.getActiveSession()

    switch (activeSession?.state || null) {
      case SELECT_STATE.IDLE:
        this.coreApi.getCursor().setCursor('default');
        break

      case SELECT_STATE.MOVING:
        this.move.updateMoving(pos);
        break;

      case SELECT_STATE.ROTATING:
        this.rotate.updateRotation(pos);
        break;

      case SELECT_STATE.SELECTING:
        this.select.updateSelection(pos);
        break;

      default:
        if (!this.rotate.isMouseNearCorner(pos)) {
          this.coreApi.getCursor().setCursor('default');
        }
        break;
    }
  }

  private handleMouseUp(): void | false {
    const activeSession = this.sessionManager.getActiveSession()
    if (!activeSession) return;

    switch (activeSession?.state || null) {
      case SELECT_STATE.ROTATING:
        this.rotate.endRotation();
        break;

      case SELECT_STATE.MOVING:
        this.move.endMoving();
        break;

      case SELECT_STATE.SELECTING:
        this.select.endSelection();
        break;

      default:

        this.coreApi.getCursor().setCursor('default');
        break;
    }
  }
}


