import type { CoreApi } from '@editor/core';
import { EventEmitter } from '@editor/event-emitter';
import type { ILayer, ILayersManager } from '@editor/types';

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
	'session::region_updated': {
		session: SingleSelectSession;
		newRegion: Rectangle | null;
		oldRegion: Rectangle | null;
	};
	'session::content_updated': {
		session: SingleSelectSession;
		newContent: SelectedContentEntity | null;
		oldContent: SelectedContentEntity | null;
		newBoundingBox: Rectangle | null;
		oldBoundingBox: Rectangle | null;
	};
	'session::committed': {
		session: SingleSelectSession;
		committedContent: SelectedContentEntity | null;
		beforeContent: SelectedContentEntity | null;
		targetLayerId: string | null;
	};
	'session::cancelled': { session: SingleSelectSession };
};

export class SingleSelectSession extends EventEmitter<SessionEventType> {
	public id: string;

	private selectedContent: SelectedContentEntity | null = null;
	private selectedRegion: Rectangle | null = null;

	private _sourceLayerId: string | null = null;
	private _targetLayerId: string | null = null;

	private layersManager: ILayersManager;

	constructor(private coreApi: CoreApi) {
		super();
		this.id = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
		this.layersManager = this.coreApi.getLayersManager();
		this.createTempLayer();
	}

	private createTempLayer(): string {
		const [tempLayerId] = this.layersManager.addTempLayer();
		this._targetLayerId = tempLayerId;
		return tempLayerId;
	}

	public setSourceLayerId(id: string | null): void {
		this._sourceLayerId = id;
	}
	public setTargetLayerId(id: string | null): void {
		this._targetLayerId = id;
	}

	public getSourceLayerId(): string | null {
		return this._sourceLayerId;
	}
	public getTargetLayerId(): string | null {
		return this._targetLayerId;
	}

	public getTargetLayer(): ILayer | null {
		if (!this._targetLayerId) return null;
		return this.layersManager.getTempLayer(this._targetLayerId);
	}

	public getSourceLayer(): ILayer | null {
		if (!this._sourceLayerId) return null;
		return this.layersManager.getLayer(this._sourceLayerId);
	}

	public getSelectedRegion(): Rectangle | null {
		return this.selectedRegion;
	}
	public getSelectedContent(): SelectedContentEntity | null {
		return this.selectedContent;
	}
	public isEmpty(): boolean {
		return !this.selectedContent;
	}

	public updateSelectedRegion(newRegion: Rectangle | null): void {
		const oldRegion = this.selectedRegion ? { ...this.selectedRegion } : null;

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
		this.emit('session::region_updated', {
			session: this,
			newRegion: this.selectedRegion,
			oldRegion
		});
	}

	public commit(layer?: ILayer): void {
		const contentToCommit = this.selectedContent
			? { ...this.selectedContent, region: { ...this.selectedContent.region } }
			: null;

		if (this._targetLayerId) this.layersManager.removeTempLayer(this._targetLayerId);
		const finalTargetLayer = layer || this.getSourceLayer();

		if (!finalTargetLayer) return this.cancel();
		if (!contentToCommit) return;

		const {
			region: { startX, startY },
			data
		} = contentToCommit;
		finalTargetLayer.setToRegion(startX, startY, data);
		const finalTargetLayerId = finalTargetLayer.id;

		this.selectedContent = null;
		this.selectedRegion = null;

		this.emit('session::committed', {
			session: this,
			committedContent: contentToCommit,
			beforeContent: null,
			targetLayerId: finalTargetLayerId
		});
	}

	public cancel(): void {
		const tempLayer = this.getTargetLayer();
		if (tempLayer && this.selectedContent) this.layersManager.removeTempLayer(tempLayer.id);

		this.selectedRegion = null;
		this.selectedContent = null;

		if (this._targetLayerId) this.layersManager.removeTempLayer(this._targetLayerId);
		this.emit('session::cancelled', { session: this });
	}

	public updateSelectedContent(newContent: SelectedContentEntity | null): void {
		const oldContent = this.selectedContent
			? { ...this.selectedContent, region: { ...this.selectedContent.region } }
			: null;
		const oldBoundingBox = this.selectedRegion ? { ...this.selectedRegion } : null;

		this.selectedContent = newContent;
		this.emit('session::content_updated', {
			session: this,
			newContent: this.selectedContent,
			oldContent,
			newBoundingBox: this.selectedRegion,
			oldBoundingBox: oldBoundingBox
		});
	}

	public serialize(): SingleSessionSnapshot {
		return {
			id: this.id,
			selectedRegion: this.selectedRegion ? { ...this.selectedRegion } : null,
			selectedContent: this.selectedContent
				? { ...this.selectedContent, region: { ...this.selectedContent.region } }
				: null,
			targetLayerId: this._targetLayerId,
			sourceLayerId: this._sourceLayerId
		};
	}

	public static fromSnapshot(
		session: SingleSelectSession,
		snapshot: SingleSessionSnapshot
	): SingleSelectSession {
		session.id = snapshot.id;
		session._sourceLayerId = snapshot.sourceLayerId;
		session.selectedRegion = snapshot.selectedRegion ? { ...snapshot.selectedRegion } : null;

		if (snapshot.selectedContent) {
			session.selectedContent = {
				...snapshot.selectedContent,
				region: { ...snapshot.selectedContent.region }
			};
			const tempLayer = session.getTargetLayer();
			if (tempLayer && session.selectedContent) {
				session._drawTilesOnLayer(session.selectedContent, tempLayer);
			}
		} else {
			session.selectedContent = null;
		}

		if (session.selectedRegion || snapshot.selectedRegion) {
			session.emit('session::region_updated', {
				session: session,
				newRegion: session.selectedRegion,
				oldRegion: null
			});
		}

		if (session.selectedContent || snapshot.selectedContent) {
			session.emit('session::content_updated', {
				session: session,
				newContent: session.selectedContent,
				oldContent: null,
				newBoundingBox: session.selectedRegion,
				oldBoundingBox: null
			});
		}

		return session;
	}

	private _drawTilesOnLayer(tile: SelectedContentEntity, layer: ILayer): void {
		const { region, data } = tile;
		layer.setToRegion(region.startX, region.startY, data);
	}
}
