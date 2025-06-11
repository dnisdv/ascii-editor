import { BaseTool } from '@editor/tool';
import { RequireActiveLayerVisible } from '@editor/tool-requirements';
import { IdleMode } from './modes/idle-mode';
import { SelectedMode } from './modes/selected-mode';
import { MovingMode } from './modes/moving-mode';
import { SelectionModeName } from './modes/modes.type';
import { SelectionModeContext } from './modes/selection-mode-ctx';
import { SelectingMode } from './modes/selecting-mode';
import { SelectionRenderer, type ExportToolTheme } from './renderer/selection-renderer';
import { SelectionSessionManager } from './session/selection-session-manager';
import type { CoreApi } from '@editor/core';
import { ResizingMode } from './modes/resizing-mode';
import type { ClipboardToolApi } from '../clipboard-tool';
import type { Rectangle } from './session/selection-session';

export class ExportTool extends BaseTool {
	readonly name = 'export';

	modeContext: SelectionModeContext;
	selectionSessionManager: SelectionSessionManager;
	selectionRenderer: SelectionRenderer;

	constructor(coreApi: CoreApi) {
		super({
			hotkey: '<A-e>',
			bus: coreApi.getBusManager(),
			coreApi,
			name: 'export',
			isVisible: true,
			config: {},
			requirements: [RequireActiveLayerVisible(coreApi, 'export')]
		});

		this.coreApi = coreApi;

		this.selectionSessionManager = new SelectionSessionManager(this.coreApi);

		this.modeContext = new SelectionModeContext();
		this.selectionRenderer = new SelectionRenderer(
			coreApi,
			this.selectionSessionManager,
			this.modeContext
		);

		this.registerModes();

		this.selectionSessionManager.on('session::region_updated', () => {
			this.saveConfig({ session: this.selectionSessionManager.serializeActiveSession() });
		});
		this.selectionSessionManager.on('manager::session_destroyed', () => {
			this.saveConfig({ session: null });
		});
		this.selectionSessionManager.on('manager::session_created', () => {
			this.saveConfig({ session: this.selectionSessionManager.serializeActiveSession() });
		});

		this.getEventApi().registerKeyPress('<C-S-C>', this.handleExportCopy.bind(this), true);
	}

	private registerModes(): void {
		this.modeContext.registerMode(SelectionModeName.IDLE, new IdleMode());
		this.modeContext.registerMode(
			SelectionModeName.SELECTING,
			new SelectingMode(this.coreApi, this.selectionSessionManager, this.selectionRenderer)
		);
		this.modeContext.registerMode(
			SelectionModeName.SELECTED,
			new SelectedMode(this.coreApi, this.selectionSessionManager)
		);
		this.modeContext.registerMode(
			SelectionModeName.MOVING,
			new MovingMode(this.coreApi, this.selectionSessionManager)
		);
		this.modeContext.registerMode(
			SelectionModeName.RESIZING,
			new ResizingMode(this.coreApi, this.selectionSessionManager)
		);
	}

	public activate(): void {
		super.activate();
		this.selectionRenderer.triggerDraw();
		this.addMouseListeners();
		this.initKeyListener();
	}

	public deactivate(): void {
		super.deactivate();

		const currentModeName = this.modeContext.getCurrentModeName();

		if (
			currentModeName === SelectionModeName.SELECTING ||
			currentModeName === SelectionModeName.MOVING ||
			currentModeName === SelectionModeName.RESIZING
		) {
			this.modeContext.transitionTo(SelectionModeName.SELECTED);
		}
		this.selectionRenderer.triggerDraw();

		this.getEventApi().unregisterMouseDown('left');
		this.getEventApi().unregisterMouseMove();
		this.getEventApi().unregisterMouseUp();
		this.getEventApi().unregisterKeyPress('<Escape>');
		this.getEventApi().unregisterUnload();
	}

	public onRequirementFailure(): void {
		super.onRequirementFailure();
	}

	public onRequirementSuccess(): void {
		super.onRequirementSuccess();
	}

	private addMouseListeners(): void {
		this.getEventApi().registerMouseDown('left', (e: MouseEvent) => {
			this.checkRequirements();
			this.modeContext.onMouseDown(e);
		});
		this.getEventApi().registerMouseMove((e: MouseEvent) => this.modeContext.onMouseMove(e));
		this.getEventApi().registerMouseUp((e: MouseEvent) => this.modeContext.onMouseUp(e));
	}

	private initKeyListener(): void {
		this.getEventApi().registerUnload(this.handleUnloadPage.bind(this));
		this.getEventApi().registerKeyPress('<Escape>', this.handleClose.bind(this));
	}

	private handleUnloadPage() {
		this.saveConfig({ session: this.selectionSessionManager.serializeActiveSession() });
	}

	public onConfigRestored(): void {
		if (this.config && this.config.session) {
			this.selectionSessionManager.restoreSession(
				this.config.session as { selectedRegion: Rectangle | null } | null
			);
			this.modeContext.transitionTo(SelectionModeName.SELECTED);
		}
	}

	public handleClose(): void {
		const activeSession = this.selectionSessionManager.getActiveSession();
		if (activeSession) {
			this.selectionSessionManager.cancelActiveSession();
		}
		this.modeContext.transitionTo(SelectionModeName.IDLE);
	}

	public handleExportCopy(event?: KeyboardEvent | undefined): void {
		event?.preventDefault();
		const activeSession = this.selectionSessionManager.getActiveSession();
		const selectedRegion = activeSession?.getSelectedRegion();

		if (!selectedRegion) {
			return;
		}

		const layersManager = this.coreApi.getLayersManager();
		const fontMetrics = this.coreApi.getFontManager().getMetrics();
		const charWidth = fontMetrics.dimensions.width;
		const charHeight = fontMetrics.dimensions.height;

		const startX = Math.floor(selectedRegion.startX / charWidth);
		const startY = Math.floor(selectedRegion.startY / charHeight);
		const width = Math.floor(selectedRegion.width / charWidth);
		const height = Math.floor(selectedRegion.height / charHeight);

		const allVisibleLayers = layersManager.getAllVisibleLayersSorted();

		let content = '';
		for (let y = 0; y < height; y++) {
			let line = '';
			for (let x = 0; x < width; x++) {
				let char = ' ';
				for (const layer of [...allVisibleLayers].reverse()) {
					const charOnLayer = layer.getChar(startX + x, startY + y);
					if (charOnLayer.trim() !== '') {
						char = charOnLayer;
						break;
					}
				}
				line += char;
			}
			content += line + (y < height - 1 ? '\n' : '');
		}

		const clipboardApi = this.coreApi.getToolManager().getToolApi<ClipboardToolApi>('clipboard');
		if (content && navigator) {
			clipboardApi?.copyText(content);
		}
	}

	public setTheme(theme: ExportToolTheme) {
		this.selectionRenderer.setTheme(theme);
	}
}
