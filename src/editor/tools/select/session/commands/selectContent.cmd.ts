import type { ISessionManagerCommand } from './type';
import type { SelectionSessionManager } from '../selection-session-manager';
import type { Rectangle, SelectedContentEntity } from '../selection-session';
import type { ILayer } from '@editor/types';
import { CommitSessionCommand } from './commitSession.cmd';
import type { CoreApi } from '@editor/core';

export class CreateSessionWithContentCommand implements ISessionManagerCommand {
	constructor(
		private coreApi: CoreApi,
		private region: { startX: number; startY: number; width: number; height: number },
		private data: string,
		private sourceLayerId: string | null = null
	) {}

	public execute(_: CoreApi, manager: SelectionSessionManager): void {
		manager.executeCommand(new CommitSessionCommand(this.coreApi));

		const session = manager.createSession();
		manager.setActiveSession(session);
		session.setSourceLayerId(this.sourceLayerId);
		session.updateSelectedContent({ region: this.region, data: this.data });

		const newWorldBoundingBox = this._calculateWorldBoundingBoxFromContent(
			session.getSelectedContent()
		);
		session.updateSelectedRegion(newWorldBoundingBox);
		this.drawContentOnLayer(session.getSelectedContent(), session.getTargetLayer());

		if (!session.isEmpty()) {
			const layer = session.getSourceLayer();
			const selectedContent = session.getSelectedContent();
			if (!layer || !selectedContent) return console.warn('Layer not found or no selected content');

			const {
				region: { startX, startY, width, height }
			} = selectedContent;
			const beforeRegion = layer.readRegion(startX, startY, width, height);

			this.coreApi.getHistoryManager().applyAction(
				{
					type: 'select::session_select',
					targetId: 'select::session',
					before: { session: null, data: beforeRegion },
					after: { session: manager.serializeSession(session) }
				},
				{ applyAction: false }
			);
		}
	}

	private drawContentOnLayer(tile: SelectedContentEntity | null, layer: ILayer | null): void {
		if (!tile || !layer) return;
		const { region, data } = tile;
		layer.setToRegion(region.startX, region.startY, data);
	}

	private _calculateWorldBoundingBoxFromContent(
		content: SelectedContentEntity | null
	): Rectangle | null {
		if (!content || !content.region) return null;

		const {
			region: { startX: cellX, startY: cellY, width: cellW, height: cellH }
		} = content;
		const worldStart = this._cellToWorld(cellX, cellY);
		const worldEnd = this._cellToWorld(cellX + cellW, cellY + cellH);

		return {
			startX: worldStart.x,
			startY: worldStart.y,
			width: worldEnd.x - worldStart.x,
			height: worldEnd.y - worldStart.y
		};
	}

	private _cellToWorld(cellX: number, cellY: number): { x: number; y: number } {
		const fontMetrics = this.coreApi.getFontManager().getMetrics();
		const charWidth = fontMetrics?.dimensions?.width;
		const charHeight = fontMetrics?.dimensions?.height;
		return { x: cellX * charWidth, y: cellY * charHeight };
	}
}
