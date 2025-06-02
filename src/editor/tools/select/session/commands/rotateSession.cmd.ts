import type { CoreApi } from '@editor/core';
import type { SingleSelectSession, SelectedContentEntity } from '../selection-session';
import type { ISessionCommand } from './type';
import type { ILayer } from '@editor/types';

export class RotateSessionCommand implements ISessionCommand {
	constructor(
		private coreApi: CoreApi,
		private degrees: number,
		private center?: { cx: number; cy: number } | null
	) {}

	public execute(session: SingleSelectSession): void {
		this.rotate(session, this.degrees, this.center);
	}

	private rotate(
		session: SingleSelectSession,
		degrees: number,
		center?: { cx: number; cy: number } | null
	): void {
		let selectedContent = session.getSelectedContent()!;
		if (!selectedContent) return;

		const tempLayer = session.getTargetLayer();
		if (!tempLayer) return;

		const rotationCenter = center || this.calculateRotationCenter(session);
		if (!rotationCenter) return;

		const rotations = Math.round(degrees / 90);
		if (rotations === 0) return;

		const clockwise = rotations > 0;
		const rotationSteps = Math.abs(rotations);

		this._clearContentFromLayer(selectedContent, tempLayer);

		for (let i = 0; i < rotationSteps; i++) {
			const newSelectedContent = rotateTile(selectedContent, rotationCenter, clockwise);
			session.updateSelectedContent(newSelectedContent);
		}

		selectedContent = session.getSelectedContent()!;
		this._drawContentOnLayer(selectedContent, tempLayer);
		const first = selectedContent;
		if (first) {
			const { startX, startY, width, height } = first.region!;
			const {
				dimensions: { width: charWidth, height: charHeight }
			} = this.coreApi.getFontManager().getMetrics();
			session.updateSelectedRegion({
				startX: startX * charWidth,
				startY: startY * charHeight,
				width: width * charWidth,
				height: height * charHeight
			});
		}
	}

	private calculateRotationCenter(session: SingleSelectSession): { cx: number; cy: number } | null {
		const selectedContent = session.getSelectedContent()!;
		if (!selectedContent) return null;

		const { startX, startY, width, height } = selectedContent.region;
		return { cx: startX + width / 2, cy: startY + height / 2 };
	}

	private _clearContentFromLayer(tile: SelectedContentEntity, layer: ILayer): void {
		const { region } = tile;
		layer.clearRegion(region.startX, region.startY, region.width, region.height);
	}

	private _drawContentOnLayer(tile: SelectedContentEntity, layer: ILayer): void {
		const { region, data } = tile;
		layer.setToRegion(region.startX, region.startY, data);
	}
}

export function rotateTile(
	tile: SelectedContentEntity,
	referenceCenter: { cx: number; cy: number },
	clockwise: boolean
): SelectedContentEntity {
	const { data, region } = tile;
	const rows = data.split('\n');
	const numRows = rows.length;
	const numCols = Math.max(...rows.map((row) => row.length));
	const paddedRows = rows.map((row) => row.padEnd(numCols, ' '));
	const rotatedGrid: string[] = [];
	if (clockwise) {
		for (let col = 0; col < numCols; col++) {
			let newRow = '';
			for (let row = numRows - 1; row >= 0; row--) {
				newRow += paddedRows[row][col];
			}
			rotatedGrid.push(newRow);
		}
	} else {
		for (let col = numCols - 1; col >= 0; col--) {
			let newRow = '';
			for (let row = 0; row < numRows; row++) {
				newRow += paddedRows[row][col];
			}
			rotatedGrid.push(newRow);
		}
	}
	const newData = rotatedGrid.join('\n');
	const newWidth = region.height;
	const newHeight = region.width;
	const rotatedCenterX = region.startX + newWidth / 2;
	const rotatedCenterY = region.startY + newHeight / 2;
	const offsetX = referenceCenter.cx - rotatedCenterX;
	const offsetY = referenceCenter.cy - rotatedCenterY;
	const newWorldRegion = {
		startX: Math.round(region.startX + offsetX) + 0,
		startY: Math.round(region.startY + offsetY) + 0,
		width: newWidth,
		height: newHeight
	};
	return { region: newWorldRegion, data: newData };
}
