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

abstract class ShapeToolState implements IShapeDrawToolState {
	constructor(protected context: IShapeToolContext) {}
	enter(): void {}
	exit(): void {}
	handleMouseDown(_e: MouseEvent): void {
		void _e;
	}
	handleMouseMove(_e: MouseEvent): void {
		void _e;
	}
	handleMouseUp(_e: MouseEvent): void {
		void _e;
	}
}

export class IdleState extends ShapeToolState {
	public enter(): void {}

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
			if (this.context.currentShape === Shapes.rectangle) {
				this.context.previewObject = new RectangleObject({
					cellX: 0,
					cellY: 0,
					width: 10,
					height: 6
				});
			} else if (this.context.currentShape === Shapes.line) {
				this.context.previewObject = new LineObject({ cellX: 0, cellY: 0, width: 10, height: 10 });
			} else if (this.context.currentShape === Shapes.elbowArrow) {
				this.context.previewObject = new ElbowArrowObject({ cellX: 0, cellY: 0, width: 10, height: 6 });
			}
			if (this.context.previewObject) {
				this.context.previewObject.setProperty('meta.preview', true);
				this.context.tempLayer.addOrReplaceObject(this.context.previewObject);
			}
		}

		if (!this.context.previewObject) return;

		const { col, row } = this.context.getCellPos(event);
		const previewWidth = this.context.previewObject.getProperty<number>('transform.width');
		const previewHeight = this.context.previewObject.getProperty<number>('transform.height');

		this.context.previewObject.setProperty('transform.x', col - previewWidth / 2);
		this.context.previewObject.setProperty('transform.y', row - previewHeight / 2);
	}
}

export class DrawingState extends ShapeToolState {
	constructor(context: IShapeToolContext, startEvent: MouseEvent) {
		super(context);
		const { col, row } = this.context.getCellPos(startEvent);
		this.context.startDragPosition = { col, row };

		if (this.context.tempLayer) {
			if (this.context.currentShape === Shapes.rectangle) {
				this.context.drawnObject = new RectangleObject({
					cellX: col,
					cellY: row,
					width: 1,
					height: 1
				});
			} else if (this.context.currentShape === Shapes.line) {
				this.context.drawnObject = new LineObject({ cellX: col, cellY: row, width: 1, height: 1 });
			} else if (this.context.currentShape === Shapes.elbowArrow) {
				const arrow = new ElbowArrowObject({ cellX: col, cellY: row, width: 1, height: 1 });
				arrow.setFromAbsPoints({ x: col, y: row }, { x: col, y: row });
				this.context.drawnObject = arrow;
			}
			if (this.context.drawnObject) this.context.tempLayer.addObject(this.context.drawnObject);
		}
	}

	public handleMouseMove(event: MouseEvent): void {
		if (!this.context.drawnObject || !this.context.startDragPosition) return;

		const { col, row } = this.context.getCellPos(event);
		const { col: startCol, row: startRow } = this.context.startDragPosition;

		if (this.context.currentShape === Shapes.elbowArrow) {
			(this.context.drawnObject as ElbowArrowObject).setFromAbsPoints(
				{ x: startCol, y: startRow },
				{ x: col, y: row }
			);
			return;
		}

		const newX = Math.min(col, startCol);
		const newY = Math.min(row, startRow);
		const newWidth = Math.abs(col - startCol) + 1;
		const newHeight = Math.abs(row - startRow) + 1;

		this.context.drawnObject.setProperty('transform.x', newX);
		this.context.drawnObject.setProperty('transform.y', newY);
		this.context.drawnObject.setProperty('transform.width', newWidth);
		this.context.drawnObject.setProperty('transform.height', newHeight);

		if (this.context.currentShape === Shapes.line) {
			const line = this.context.drawnObject as LineObject;
			const startCorner = {
				x: startCol <= col ? 0 : newWidth - 1,
				y: startRow <= row ? 0 : newHeight - 1
			};
			const endCorner = {
				x: startCol <= col ? newWidth - 1 : 0,
				y: startRow <= row ? newHeight - 1 : 0
			};
			line.setEndpointsFromCorners(startCorner, endCorner);
		}
	}

	public handleMouseUp(event: MouseEvent): void {
		if (!this.context.drawnObject || !this.context.startDragPosition) return;

		const { col, row } = this.context.getCellPos(event);
		const distance = Math.hypot(
			col - this.context.startDragPosition.col,
			row - this.context.startDragPosition.row
		);

		if (distance < 5) {
			if (this.context.currentShape === Shapes.elbowArrow) {
				const hw = 5;
				const hh = 3;
				(this.context.drawnObject as ElbowArrowObject).setFromAbsPoints(
					{ x: col - hw, y: row - hh },
					{ x: col + hw, y: row + hh }
				);
			} else {
				const defaultSize =
					this.context.currentShape === Shapes.line
						? { width: 10, height: 10 }
						: { width: 10, height: 6 };

				this.context.drawnObject.setProperty('transform.x', col - defaultSize.width / 2);
				this.context.drawnObject.setProperty('transform.y', row - defaultSize.height / 2);
				this.context.drawnObject.setProperty('transform.width', defaultSize.width);
				this.context.drawnObject.setProperty('transform.height', defaultSize.height);

				if (this.context.currentShape === Shapes.line) {
					const line = this.context.drawnObject as LineObject;
					line.setEndpointsFromCorners(
						{ x: 0, y: 0 },
						{ x: defaultSize.width - 1, y: defaultSize.height - 1 }
					);
				}
			}
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
