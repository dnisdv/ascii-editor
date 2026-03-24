import { EventEmitter } from '../event-emitter';
import type { ISmartObject } from '@editor/objects/smart-object.interface';
import type { FontManager } from '@editor/font-manager';
import { SelectionSessionManager } from './session/selection-session-manager';
import { AppendRegionCommand } from './session/commands/appendRegion.cmd';
import type { Config } from '@editor/config';
import type { LayersManager } from '@editor/layers/layers-manager';
import type { SelectionSession } from './session/selection-session';
import { PopulateRegionCommand } from './session/commands/populateRegion.cmd';
import { SubtractRegionCommand } from './session/commands/substractRegion.cmd';
import type { CellRectangle } from '@editor/types';
import type { HistoryManager } from '@editor/history-manager';
import { CommitSessionCommand } from './session/commands/commitSession.cmd';
import { SelectionMode } from './selection-mode';
import { MoveByCommand } from './session/commands/moveBy.cmd';
import { RotateByCommand } from './session/commands/rotateSession.cmd';
import type { RotationStep } from '@editor/objects/smart-object.interface';
import { ResizeByCommand } from './session/commands/resizeSession.cmd';
import { RemoveSessionCommand } from './session/commands/removeSession.cmd';
import { AppendObjectsCommand } from './session/commands/appendObjects.cmd';
import { SelectObjectsCommand } from './session/commands/selectObjects.cmd';
import { RemoveObjectsCommand } from './session/commands/removeObjects.cmd';
import { DeselectObjectsCommand } from './session/commands/deselectObjects.cmd';
import { BringToFrontCommand } from './session/commands/bringToFront.cmd';
import { SendToBackCommand } from './session/commands/sendToBack.cmd';
import { BringForwardCommand } from './session/commands/bringForward.cmd';
import { SendBackwardCommand } from './session/commands/sendBackward.cmd';
import type { SmartObjectsManager } from '@editor/smart-objects-manager';
import type { TextGridObject } from '@editor/objects/text-grid-object';

type SelectionEvents = {
	'selection-changed': ISmartObject[];
	'session::changed': { session: SelectionSession };
	'session::committed': { session: SelectionSession };
	'session::cancelled': { session: SelectionSession };
	'manager::session_created': undefined;
	'manager::session_destroyed': undefined;
	'manager::session_change': undefined;
};

type LayersManagerDependencies = {
	layersManager: LayersManager;
	fontManager: FontManager;
	config: Config;
	historyManager: HistoryManager;
	smartObjectsManager: SmartObjectsManager;
};

export class SelectionManager extends EventEmitter<SelectionEvents> {
	private layersManager: LayersManager;
	private fontManager: FontManager;
	private config: Config;
	private historyManager: HistoryManager;
	private selectionSessionManager: SelectionSessionManager;

	public currentCapabilities = {
		canMove: false,
		canResize: false,
		canRotate: false
	};

	constructor({
		layersManager,
		fontManager,
		config,
		historyManager,
		smartObjectsManager
	}: LayersManagerDependencies) {
		super();
		this.layersManager = layersManager;
		this.fontManager = fontManager;
		this.config = config;
		this.historyManager = historyManager;

		this.selectionSessionManager = new SelectionSessionManager({
			layersManager,
			fontManager,
			config,
			historyManager,
			smartObjectsManager
		});

		this.proxy(this.selectionSessionManager, {
			events: [
				'session::changed',
				'session::committed',
				'session::cancelled',
				'manager::session_created',
				'manager::session_destroyed',
				'manager::session_change'
			]
		});
	}

	public selectRegion(region: CellRectangle, mode: SelectionMode): boolean {
		const activeLayerId = this.layersManager.getActiveLayerKey();
		if (!activeLayerId) return false;

		const deps = {
			layersManager: this.layersManager,
			fontManager: this.fontManager,
			config: this.config,
			historyManager: this.historyManager
		};

		if (mode === SelectionMode.SET) {
			this.commitSelection();
			const command = new PopulateRegionCommand(deps, region);
			this.selectionSessionManager.executeCommand(command);
		} else if (mode === SelectionMode.ADD) {
			const command = new AppendRegionCommand(
				{ layersManager: this.layersManager, historyManager: this.historyManager },
				region
			);
			this.selectionSessionManager.executeCommand(command);
		} else if (mode === SelectionMode.SUBTRACT) {
			const command = new SubtractRegionCommand(
				{ layersManager: this.layersManager, historyManager: this.historyManager },
				region
			);
			this.selectionSessionManager.executeCommandOnActiveSession(command);
		}

		const session = this.getActiveSession();
		return session ? !session.isEmpty() : false;
	}

	public selectAll(): void {
		const activeLayer = this.layersManager.getActiveLayer();
		if (!activeLayer) return;

		const allObjects = activeLayer.getObjects();

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		let hasContent = false;

		const smartObjects = allObjects.filter((obj) => obj.type !== 'text-grid');
		for (const obj of smartObjects) {
			const x = (obj.getProperty('transform.x') as number) ?? 0;
			const y = (obj.getProperty('transform.y') as number) ?? 0;
			const w = (obj.getProperty('transform.width') as number) ?? 0;
			const h = (obj.getProperty('transform.height') as number) ?? 0;

			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x + w);
			maxY = Math.max(maxY, y + h);
			hasContent = true;
		}

		const textGrids = allObjects.filter((obj) => obj.type === 'text-grid') as TextGridObject[];
		for (const grid of textGrids) {
			const tileMap = grid.getTileMap();
			const tiles = tileMap.queryAll();
			const tileSize = tileMap.tileSize;

			for (const tile of tiles) {
				if (tile.isEmpty()) continue;

				const tx = tile.x * tileSize;
				const ty = tile.y * tileSize;

				minX = Math.min(minX, tx);
				minY = Math.min(minY, ty);
				maxX = Math.max(maxX, tx + tileSize);
				maxY = Math.max(maxY, ty + tileSize);
				hasContent = true;
			}
		}

		if (hasContent) {
			const region = {
				cellX: minX,
				cellY: minY,
				width: maxX - minX,
				height: maxY - minY
			};
			this.selectRegion(region, SelectionMode.SET);
		}
	}

	public selectInverse(): void {
		const activeLayer = this.layersManager.getActiveLayer();
		if (!activeLayer) return;

		const session = this.getActiveSession();
		const objects = activeLayer.getObjects();

		if (objects.length > 0) {
			const selectedIds = new Set<string>();
			if (session) {
				const sessionObjects = session.getSelectedObjects();
				sessionObjects.forEach((o) => selectedIds.add(o.id));
			}

			const inverseObjects = objects.filter(
				(o) => !selectedIds.has(o.id) && o.type !== 'text-grid'
			);

			this.commitSelection();
			if (inverseObjects.length > 0) {
				const command = new SelectObjectsCommand(inverseObjects);
				this.selectionSessionManager.executeCommand(command);
			}
		}
	}

	public bringToFront(): void {
		const command = new BringToFrontCommand();
		this.selectionSessionManager.executeCommand(command);
	}

	public sendToBack(): void {
		const command = new SendToBackCommand();
		this.selectionSessionManager.executeCommand(command);
	}

	public bringForward(): void {
		const command = new BringForwardCommand();
		this.selectionSessionManager.executeCommand(command);
	}

	public sendBackward(): void {
		const command = new SendBackwardCommand();
		this.selectionSessionManager.executeCommand(command);
	}

	public replaceSelectionWithRegion(region: CellRectangle): boolean {
		const deps = {
			layersManager: this.layersManager,
			fontManager: this.fontManager,
			config: this.config,
			historyManager: this.historyManager
		};
		this.selectionSessionManager.executeCommand(new PopulateRegionCommand(deps, region));

		return !this.getActiveSession()?.isEmpty();
	}

	public substractSelectionWithRegion(region: CellRectangle): boolean {
		this.selectionSessionManager.executeCommandOnActiveSession(
			new SubtractRegionCommand(
				{ layersManager: this.layersManager, historyManager: this.historyManager },
				region
			)
		);

		return !this.getActiveSession()?.isEmpty();
	}

	public appendToSelectionWithRegion(region: CellRectangle): boolean {
		this.selectionSessionManager.executeCommand(
			new AppendRegionCommand(
				{ layersManager: this.layersManager, historyManager: this.historyManager },
				region
			)
		);

		return !this.getActiveSession()?.isEmpty();
	}

	public commitSelection(): void {
		const session = this.selectionSessionManager.getActiveSession();
		if (session && !session.isEmpty()) {
			const commitCommand = new CommitSessionCommand();
			this.selectionSessionManager.executeCommand(commitCommand);
		}
	}

	public appendSmartObjects(objects: ISmartObject[]): void {
		this.selectionSessionManager.executeCommand(
			new AppendObjectsCommand({ historyManager: this.historyManager }, { objects })
		);
	}

	public selectSmartObjects(objects: ISmartObject[], options?: { clearRegion?: boolean }): void {
		this.selectionSessionManager.executeCommand(new SelectObjectsCommand(objects, options));
	}

	public removeSmartObjects(ids: string[]): void {
		this.selectionSessionManager.executeCommandOnActiveSession(
			new RemoveObjectsCommand({ historyManager: this.historyManager }, { objectsIds: ids })
		);
	}

	public deselectSmartObjects(ids: string[]): void {
		this.selectionSessionManager.executeCommandOnActiveSession(
			new DeselectObjectsCommand({ historyManager: this.historyManager }, { objectsIds: ids })
		);
	}

	public moveSelection(
		deltaX: number,
		deltaY: number,
		options?: { recordHistory?: boolean; batchId?: string }
	): void {
		this.selectionSessionManager.executeCommandOnActiveSession(
			new MoveByCommand(
				{ layersManager: this.layersManager, historyManager: this.historyManager },
				{ x: deltaX, y: deltaY },
				options
			)
		);
	}

	public rotateSelection(angle: RotationStep): void {
		this.selectionSessionManager.executeCommandOnActiveSession(
			new RotateByCommand({ historyManager: this.historyManager }, angle)
		);
	}

	public resizeSelection(
		delta: { dx: number; dy: number; dw: number; dh: number },
		options?: { recordHistory?: boolean }
	): void {
		this.selectionSessionManager.executeCommandOnActiveSession(
			new ResizeByCommand({ historyManager: this.historyManager }, delta, options)
		);
	}

	public removeSelection(): void {
		const session = this.selectionSessionManager.getActiveSession();
		if (session && !session.isEmpty()) {
			const removeCommand = new RemoveSessionCommand();
			this.selectionSessionManager.executeCommand(removeCommand);
		}
	}

	public getActiveSession(): SelectionSession | null {
		return this.selectionSessionManager.getActiveSession();
	}

	public getSelectionBoundsWorld(): {
		left: number;
		top: number;
		right: number;
		bottom: number;
	} | null {
		const session = this.getActiveSession();
		if (!session || session.isEmpty()) return null;
		const bb = session.boundingBox;
		const { width: cw, height: ch } = this.fontManager.getMetrics().dimensions;
		const left = bb.cellX * cw;
		const top = bb.cellY * ch;
		const right = left + bb.width * cw;
		const bottom = top + bb.height * ch;
		return { left, top, right, bottom };
	}

	public isPointInsideSelectionWorld(worldX: number, worldY: number): boolean {
		const bounds = this.getSelectionBoundsWorld();
		if (!bounds) return false;
		return (
			worldX >= bounds.left &&
			worldX <= bounds.right &&
			worldY >= bounds.top &&
			worldY <= bounds.bottom
		);
	}

	public isPointInsideSelectionContentWorld(worldX: number, worldY: number): boolean {
		const session = this.getActiveSession();
		if (!session || session.isEmpty()) return false;
		const selected = session.getSelectedObjects();
		const { width: cw, height: ch } = this.fontManager.getMetrics().dimensions;
		if (selected.length === 1) {
			const cellX = Math.floor(worldX / cw);
			const cellY = Math.floor(worldY / ch);
			try {
				return !!selected[0].hitTest(cellX, cellY);
			} catch {
				return this.isPointInsideSelectionWorld(worldX, worldY);
			}
		}
		return this.isPointInsideSelectionWorld(worldX, worldY);
	}
}
