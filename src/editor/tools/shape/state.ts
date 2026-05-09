import type { ISmartObject } from '@editor/objects/smart-object.interface';
import { RectangleObject } from './rectangle-object';
import { LineObject } from './line-object';
import { ElbowArrowObject } from './elbow-arrow-object';
import { Shapes } from './shape-draw-tool';
import type { IShapeToolContext } from './shape-draw-tool';

export interface IShapeDrawToolState {
	enter(): void;
	exit(): void;
	handleMouseDown(event: MouseEvent): void;
	handleMouseMove(event: MouseEvent): void;
	handleMouseUp(event: MouseEvent): void;
}

type Pos = { col: number; row: number };

interface ShapeHandler {
	createPreview(): ISmartObject;
	createObject(col: number, row: number): ISmartObject;
	updateDrag(obj: ISmartObject, start: Pos, end: Pos): void;
	placeDefault(obj: ISmartObject, col: number, row: number): void;
}

function applyBounds(obj: ISmartObject, start: Pos, end: Pos) {
	const x = Math.min(end.col, start.col);
	const y = Math.min(end.row, start.row);
	const w = Math.abs(end.col - start.col) + 1;
	const h = Math.abs(end.row - start.row) + 1;
	obj.setProperty('transform.x', x);
	obj.setProperty('transform.y', y);
	obj.setProperty('transform.width', w);
	obj.setProperty('transform.height', h);
	return { x, y, w, h };
}

const rectangleHandler: ShapeHandler = {
	createPreview: () => new RectangleObject({ cellX: 0, cellY: 0, width: 10, height: 6 }),
	createObject: (col, row) => new RectangleObject({ cellX: col, cellY: row, width: 1, height: 1 }),
	updateDrag: (obj, start, end) => applyBounds(obj, start, end),
	placeDefault: (obj, col, row) => {
		obj.setProperty('transform.x', col - 5);
		obj.setProperty('transform.y', row - 3);
		obj.setProperty('transform.width', 10);
		obj.setProperty('transform.height', 6);
	}
};

const lineHandler: ShapeHandler = {
	createPreview: () => new LineObject({ cellX: 0, cellY: 0, width: 10, height: 10 }),
	createObject: (col, row) => new LineObject({ cellX: col, cellY: row, width: 1, height: 1 }),
	updateDrag: (obj, start, end) => {
		const { w, h } = applyBounds(obj, start, end);
		const startCorner = { x: start.col <= end.col ? 0 : w - 1, y: start.row <= end.row ? 0 : h - 1 };
		const endCorner = { x: start.col <= end.col ? w - 1 : 0, y: start.row <= end.row ? h - 1 : 0 };
		(obj as LineObject).setEndpointsFromCorners(startCorner, endCorner);
	},
	placeDefault: (obj, col, row) => {
		obj.setProperty('transform.x', col - 5);
		obj.setProperty('transform.y', row - 5);
		obj.setProperty('transform.width', 10);
		obj.setProperty('transform.height', 10);
		(obj as LineObject).setEndpointsFromCorners({ x: 0, y: 0 }, { x: 9, y: 9 });
	}
};

const elbowArrowHandler: ShapeHandler = {
	createPreview: () => new ElbowArrowObject({ cellX: 0, cellY: 0, width: 10, height: 6 }),
	createObject: (col, row) => {
		const arrow = new ElbowArrowObject({ cellX: col, cellY: row, width: 1, height: 1 });
		arrow.setFromAbsPoints({ x: col, y: row }, { x: col, y: row });
		return arrow;
	},
	updateDrag: (obj, start, end) => {
		(obj as ElbowArrowObject).setFromAbsPoints(
			{ x: start.col, y: start.row },
			{ x: end.col, y: end.row }
		);
	},
	placeDefault: (obj, col, row) => {
		(obj as ElbowArrowObject).setFromAbsPoints({ x: col - 5, y: row - 3 }, { x: col + 5, y: row + 3 });
	}
};

function getHandler(shape: Shapes): ShapeHandler {
	switch (shape) {
		case Shapes.line: return lineHandler;
		case Shapes.elbowArrow: return elbowArrowHandler;
		default: return rectangleHandler;
	}
}

abstract class ShapeToolState implements IShapeDrawToolState {
	constructor(protected context: IShapeToolContext) {}
	enter(): void {}
	exit(): void {}
	handleMouseDown(_e: MouseEvent): void { void _e; }
	handleMouseMove(_e: MouseEvent): void { void _e; }
	handleMouseUp(_e: MouseEvent): void { void _e; }
}

export class IdleState extends ShapeToolState {
	public exit(): void {
		if (this.context.previewObject && this.context.tempLayer) {
			this.context.tempLayer.removeObject(this.context.previewObject.id);
			this.context.previewObject = null;
		}
	}

	public handleMouseDown(event: MouseEvent): void {
		this.context.coreApi.getSelectionManager().commitSelection();
		if (event.button !== 0) return;
		this.context.setState(new DrawingState(this.context, event));
	}

	public handleMouseMove(event: MouseEvent): void {
		if (!this.context.previewObject && this.context.tempLayer) {
			const handler = getHandler(this.context.currentShape);
			this.context.previewObject = handler.createPreview();
			this.context.previewObject.setProperty('meta.preview', true);
			this.context.tempLayer.addOrReplaceObject(this.context.previewObject);
		}

		if (!this.context.previewObject) return;

		const { col, row } = this.context.getCellPos(event);
		const w = this.context.previewObject.getProperty<number>('transform.width');
		const h = this.context.previewObject.getProperty<number>('transform.height');
		this.context.previewObject.setProperty('transform.x', col - w / 2);
		this.context.previewObject.setProperty('transform.y', row - h / 2);
	}
}

export class DrawingState extends ShapeToolState {
	constructor(context: IShapeToolContext, startEvent: MouseEvent) {
		super(context);
		const { col, row } = this.context.getCellPos(startEvent);
		this.context.startDragPosition = { col, row };

		if (this.context.tempLayer) {
			const handler = getHandler(this.context.currentShape);
			this.context.drawnObject = handler.createObject(col, row);
			this.context.tempLayer.addObject(this.context.drawnObject);
		}
	}

	public handleMouseMove(event: MouseEvent): void {
		if (!this.context.drawnObject || !this.context.startDragPosition) return;

		const { col, row } = this.context.getCellPos(event);
		const handler = getHandler(this.context.currentShape);
		handler.updateDrag(this.context.drawnObject, this.context.startDragPosition, { col, row });
	}

	public handleMouseUp(event: MouseEvent): void {
		if (!this.context.drawnObject || !this.context.startDragPosition) return;

		const { col, row } = this.context.getCellPos(event);
		const distance = Math.hypot(col - this.context.startDragPosition.col, row - this.context.startDragPosition.row);

		if (distance < 5) {
			const handler = getHandler(this.context.currentShape);
			handler.placeDefault(this.context.drawnObject, col, row);
		}

		this.commitObject();
		this.context.setState(new IdleState(this.context));
	}

	private commitObject(): void {
		if (!this.context.drawnObject || !this.context.tempLayer) return;

		const object = this.context.drawnObject;
		this.context.drawnObject = null;
		this.context.startDragPosition = null;

		this.context.tempLayer.removeObject(object.id);
		this.context.coreApi.getSelectionManager().selectSmartObjects([object]);
	}

	public exit(): void {
		if (this.context.drawnObject) this.commitObject();
	}
}
