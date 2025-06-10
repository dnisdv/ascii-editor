import type { CoreApi } from '@editor/core';
import { EventEmitter } from '@editor/event-emitter';

export type Rectangle = {
	startX: number;
	startY: number;
	width: number;
	height: number;
};

export interface SelectedContentEntity {
	region: Rectangle;
	data: string;
}

export interface SingleSessionSnapshot {
	id: string;
	selectedRegion: Rectangle | null;
	selectedContent: SelectedContentEntity | null;
	targetLayerId: string | null;
	sourceLayerId: string | null;
}

export type SessionEventType = {
	'session::initialized': { session: SingleSelectSession };
	'session::region_updated': { session: SingleSelectSession };
};

export class SingleSelectSession extends EventEmitter<SessionEventType> {
	public id: string;

	private selectedRegion: Rectangle | null = null;

	constructor(private coreApi: CoreApi) {
		super();
		this.id = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
	}

	public getSelectedRegion(): Rectangle | null {
		return this.selectedRegion;
	}

	public moveBy(offset: { x: number; y: number }) {
		if (!this.selectedRegion) return;

		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();

		const newWorldX = this.selectedRegion.startX + offset.x * charWidth;

		const newWorldY = this.selectedRegion.startY + offset.y * charHeight;

		const newBoundingBox: Rectangle = {
			startX: newWorldX,
			startY: newWorldY,
			width: this.selectedRegion.width,
			height: this.selectedRegion.height
		};
		this.updateSelectedRegion(newBoundingBox);
	}

	public updateSelectedRegion(newRegion: Rectangle | null): void {
		let processedRegion: Rectangle | null = null;

		if (newRegion) {
			const regionToProcess: Rectangle = { ...newRegion };

			if (regionToProcess.width < 0) {
				regionToProcess.startX = regionToProcess.startX + regionToProcess.width;
				regionToProcess.width = Math.abs(regionToProcess.width);
			}

			if (regionToProcess.height < 0) {
				regionToProcess.startY = regionToProcess.startY + regionToProcess.height;
				regionToProcess.height = Math.abs(regionToProcess.height);
			}
			processedRegion = regionToProcess;
		}

		this.selectedRegion = processedRegion;
		this.emit('session::region_updated');
	}
}
