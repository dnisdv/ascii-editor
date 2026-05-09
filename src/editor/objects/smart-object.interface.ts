import type { CellRectangle, ObjectOperation } from '../types/external';
import type { ContextMenuList, MenuContext } from '@editor/context-menu/context-menu.interface';
import type { AsciiRenderingDeps } from '@editor/canvas/strategies/ascii-rendering-strategy';
import type {
	SerializedSmartObjectData,
	SmartObjectSerializableSchemaType
} from '@editor/serializer/smart-object.schema';
import type { IEventEmitter } from '@editor/types';
import type { Config } from '@editor/config';
import type { EditorCommands } from '@editor/commands';
import type { PropertyManager } from './property-manager';
import type { Properties } from './properties';

export type SmartObjectEventMap = {
	op: ObjectOperation;
	update: undefined;
};

export interface SmartObjectAnchor {
	id: string;
	x: number;
	y: number;
	cursor?: string;
	type: 'geometric' | 'control' | 'visual' | 'rotation';
	draggable?: boolean;
	screenOffset?: { x: number; y: number };
}

export interface SmartObjectCapabilities {
	canMove: boolean;
	canResize: boolean;
	canRotate: boolean;
	canSelect: boolean;
}

export interface SelectionOverlayDrawer {
	rectCell(
		cellX: number,
		cellY: number,
		width: number,
		height: number,
		options?: { strokeWidth?: number }
	): void;
	lineCell(
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		options?: { strokeWidth?: number }
	): void;
}

export interface ISmartObject extends IEventEmitter<SmartObjectEventMap> {
	readonly id: string;
	readonly type: string;
	readonly capabilities: SmartObjectCapabilities;
	readonly properties: PropertyManager<Properties>;

	render(deps: AsciiRenderingDeps): void;

	clone(): ISmartObject;

	setProperty(key: string, value: unknown): void;
	setPropertyVisual(path: string, value: unknown): void;
	commitProperties(paths?: string[]): void;
	discardProperties(paths?: string[]): void;
	getProperty<T = unknown>(path: string): T;
	getCommittedProperty<T = unknown>(path: string): T;
	getProperties(): Map<string, unknown>;

	hitTest(cellX: number, cellY: number): boolean;
	regionHitTest(region: CellRectangle): boolean;

	hitTestMoveArea(cellX: number, cellY: number): boolean;
	getAnchors?(): SmartObjectAnchor[];
	getRotationAnchors?(charWidth: number, charHeight: number): SmartObjectAnchor[];
	hitTestAnchor?(cellX: number, cellY: number): SmartObjectAnchor | null;
	onAnchorDragStart?(anchorId: string): void;
	moveAnchor?(anchorId: string, toCellX: number, toCellY: number): void;

	setAnchorsAbs?(anchors: Array<{ x: number; y: number }>): void;

	renderSelectionOverlay?(draw: SelectionOverlayDrawer): boolean | void;

	getContextMenuSchema?(ctx: MenuContext): ContextMenuList;

	toString?(): string;

	dispose(): void;
	serialize(): SmartObjectSerializableSchemaType;
	toJson(): SerializedSmartObjectData;
}

export type RotationStep = 90 | -90 | 180 | 270 | -270;

export interface IRotatable {
	applyRotation(degrees: RotationStep): void;
	getRotationContent?(): string;
	restoreRotationContent?(content: string): void;
}

export function isRotatable(obj: ISmartObject): obj is ISmartObject & IRotatable {
	return typeof (obj as unknown as IRotatable).applyRotation === 'function';
}

export interface SmartObjectClass {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	new (...args: any[]): ISmartObject;
	deserialize(
		config: Config,
		data: SerializedSmartObjectData,
		fullData?: SmartObjectSerializableSchemaType
	): ISmartObject;
	registerCommands?(commands: EditorCommands): void;
}
