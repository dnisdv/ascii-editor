import {
	MetaProperties,
	StandardGroupKeys,
	TransformProperties,
	type Properties
} from './properties';
import type {
	SmartObjectCapabilities,
	ISmartObject,
	SmartObjectEventMap,
	SmartObjectAnchor,
	SelectionOverlayDrawer
} from './smart-object.interface';
import type {
	SerializedSmartObjectData,
	SmartObjectSerializableSchemaType
} from '@editor/serializer/smart-object.schema';
import type { CellRectangle } from '@editor/types';

import type { AsciiRenderingDeps } from '@editor/canvas/strategies/ascii-rendering-strategy';
import type { Config } from '@editor/config';
import type { ContextMenuList, MenuContext } from '@editor/context-menu/context-menu.interface';

import { EventEmitter } from '@editor/event-emitter';
import { PropertyManager } from './property-manager';
import { nanoid } from 'nanoid';

type SmartObjectDeps = {
	capabilities: Partial<SmartObjectCapabilities>;
	properties: Properties;
};

export abstract class BaseSmartObject
	extends EventEmitter<SmartObjectEventMap>
	implements ISmartObject
{
	public id: string;
	public abstract readonly type: string;

	public rotation: number = 0;
	public capabilities: SmartObjectCapabilities;
	public properties: PropertyManager<Properties>;

	protected anchors: SmartObjectAnchor[] = [];
	private static readonly ROTATION_HANDLE_OFFSET = 22;

	constructor(bounds: CellRectangle, deps: SmartObjectDeps) {
		super();
		this.id = nanoid();

		this.properties = new PropertyManager(
			{
				...deps.properties,
				[StandardGroupKeys.META]: {
					[MetaProperties.NAME]: { type: 'string', value: 'New Object' }
				},
				[StandardGroupKeys.TRANSFORM]: {
					[TransformProperties.X]: { type: 'number', value: bounds.cellX },
					[TransformProperties.Y]: { type: 'number', value: bounds.cellY },
					[TransformProperties.WIDTH]: { type: 'number', value: bounds.width, min: 1 },
					[TransformProperties.HEIGHT]: { type: 'number', value: bounds.height, min: 1 }
				}
			},
			(op) => {
				for (const _op of op) {
					this.emit('op', { ..._op, path: `properties.${_op.path}` });
				}
			},
			() => {
				this.emit('update');
			}
		);

		this.capabilities = {
			canMove: false,
			canResize: false,
			canRotate: false,
			canSelect: false,
			...(deps.capabilities ?? {})
		};
	}

	public abstract render(deps: AsciiRenderingDeps): void;
	public abstract clone(): ISmartObject;
	public abstract hitTest(cellX: number, cellY: number): boolean;
	public abstract regionHitTest(region: CellRectangle): boolean;

	public getAnchors(): SmartObjectAnchor[] {
		return this.anchors;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public getRotationAnchors(_charWidth: number, _charHeight: number): SmartObjectAnchor[] {
		if (!this.capabilities.canRotate) return [];
		const x = Math.round(this.getProperty<number>('transform.x'));
		const y = Math.round(this.getProperty<number>('transform.y'));
		const w = Math.max(1, Math.round(this.getProperty<number>('transform.width')));
		const h = Math.max(1, Math.round(this.getProperty<number>('transform.height')));
		const o = BaseSmartObject.ROTATION_HANDLE_OFFSET;
		return [
			{ id: 'rot-tl', x,     	   y,      type: 'rotation', cursor: 'rotate', draggable: false, screenOffset: { x: -o, y: -o } },
			{ id: 'rot-tr', x: x+w,    y,      type: 'rotation', cursor: 'rotate', draggable: false, screenOffset: { x:  o, y: -o } },
			{ id: 'rot-bl', x,     	   y: y+h, type: 'rotation', cursor: 'rotate', draggable: false, screenOffset: { x: -o, y:  o } },
			{ id: 'rot-br', x: x+w,    y: y+h, type: 'rotation', cursor: 'rotate', draggable: false, screenOffset: { x:  o, y:  o } },
		];
	}
	public hitTestAnchor(_cellX: number, _cellY: number): SmartObjectAnchor | null {
		void _cellX;
		void _cellY;
		return null;
	}

	public moveAnchor(_anchorId: string, _toCellX: number, _toCellY: number): void {
		void _anchorId;
		void _toCellX;
		void _toCellY;
	}

	public setProperty(path: string, value: unknown): void {
		this.properties.set(path, value);
		this.emit('update');
	}

	public setPropertyVisual(path: string, value: unknown): void {
		this.properties.setVisual(path, value);
	}

	public commitProperties(paths?: string[]): void {
		this.properties.commit(paths);
		this.emit('update');
	}

	public setAnchorsAbs(_: Array<{ x: number; y: number }>): void {
		void _;
		throw new Error('Method not implemented.');
	}

	public discardProperties(paths?: string[]): void {
		this.properties.discard(paths);
		this.emit('update');
	}

	public getPropertyManager(): PropertyManager<Properties> {
		return this.properties;
	}

	public getProperty<T = unknown>(path: string): T {
		return this.properties.get(path) as T;
	}

	public getCommittedProperty<T = unknown>(path: string): T {
		return this.properties.getCommitted(path) as T;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public getProperties(): any {
		return this.properties;
	}

	public getName(): string {
		return String(this.properties.get('meta.name')) || 'Unnamed Object';
	}

	public setName(name: string): void {
		this.properties.set('meta.name', name);
		this.emit('update');
	}

	public hitTestMoveArea(cellX: number, cellY: number): boolean {
		const x = Math.round(this.getProperty<number>('transform.x'));
		const y = Math.round(this.getProperty<number>('transform.y'));
		const w = Math.max(1, Math.round(this.getProperty<number>('transform.width')));
		const h = Math.max(1, Math.round(this.getProperty<number>('transform.height')));
		const cx = Math.floor(cellX);
		const cy = Math.floor(cellY);
		return cx >= x && cx < x + w && cy >= y && cy < y + h;
	}

	public renderSelectionOverlay(draw: SelectionOverlayDrawer): boolean {
		const x = Number(this.getProperty('transform.x')) || 0;
		const y = Number(this.getProperty('transform.y')) || 0;
		const w = Number(this.getProperty('transform.width')) || 0;
		const h = Number(this.getProperty('transform.height')) || 0;
		draw.rectCell(x, y, w, h);
		return true;
	}

	public getContextMenuSchema?(ctx: MenuContext): ContextMenuList {
		if (ctx.target !== 'selection') return [];
		return [];
	}

	public dispose(): void {}

	public toJson(): SmartObjectSerializableSchemaType['data'] {
		throw new Error('Must be implemented');
	}

	static deserialize(config: Config, data: SerializedSmartObjectData): ISmartObject {
		void config;
		void data;
		throw new Error('Must be implemented');
	}

	public serialize(): SmartObjectSerializableSchemaType {
		return {
			id: this.id,
			type: this.type,
			properties: this.properties.snapshot(),
			data: this.toJson()
		};
	}
}
