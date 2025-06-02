import type { CoreApi } from '@editor/core';
import type { ILayer } from '@editor/types';

export abstract class Shape {
	protected startCol: number = 0;
	protected startRow: number = 0;
	protected currentCol: number = 0;
	protected currentRow: number = 0;
	protected activeLayer: ILayer | null = null;

	constructor(
		protected coreApi: CoreApi,
		protected layer: ILayer,
		protected drawChar: string = '#'
	) {}

	startDraw(col: number, row: number): void {
		this.activeLayer = this.layer;
		this.startCol = col;
		this.startRow = row;
		this.currentCol = col;
		this.currentRow = row;
	}

	updateDraw(col: number, row: number): void {
		this.currentCol = col;
		this.currentRow = row;
		this.draw();
	}

	endDraw(): void {
		const activeLayer = this.coreApi.getLayersManager().getActiveLayer();
		if (!activeLayer) return;
	}

	toString(): string | null {
		return null;
	}

	abstract area(): { startX: number; startY: number; endX: number; endY: number };

	draw(): void {}
}
