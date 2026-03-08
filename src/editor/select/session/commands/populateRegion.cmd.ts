import type { ISessionManagerCommand, ISessionManagerCommandDeps } from './type';
import { type CellRectangle } from '@editor/types';
import type { Config } from '@editor/config';
import type { FontManager } from '@editor/font-manager';
import { findObjectsInRegion } from './utils';
import type { HistoryManager } from '@editor/history-manager';
import type { LayersManager } from '@editor/layers/layers-manager';
import { sessionSelect } from '@editor/select/history/session-select';

type AppendRegionDeps = {
	layersManager: LayersManager;
	config: Config;
	fontManager: FontManager;
	historyManager: HistoryManager;
};

type AppendRegionPayload = {
	region: CellRectangle;
};

export class PopulateRegionCommand implements ISessionManagerCommand {
	private layersManager: LayersManager;

	constructor(
		private deps: AppendRegionDeps,
		private region: AppendRegionPayload['region']
	) {
		this.layersManager = this.deps.layersManager;
	}

	private normalizeRect(rect: CellRectangle): CellRectangle {
		const x = rect.width < 0 ? rect.cellX + rect.width : rect.cellX;
		const y = rect.height < 0 ? rect.cellY + rect.height : rect.cellY;
		const widthAbs = Math.abs(rect.width);
		const heightAbs = Math.abs(rect.height);

		const width = widthAbs === 0 ? 1 : widthAbs;
		const height = heightAbs === 0 ? 1 : heightAbs;
		return { cellX: x, cellY: y, width, height };
	}

	public execute(_: ISessionManagerCommandDeps): void {
		void _;
		const sourceLayer = this.layersManager.getActiveLayer();
		if (!sourceLayer) return;

		const normalized = this.normalizeRect(this.region);

		const foundObjects = findObjectsInRegion(normalized, sourceLayer, null);
		if (foundObjects.length === 0 || foundObjects.length < 0) return;

		this.deps.historyManager.execute(sessionSelect, 'select::session', {
			objects: foundObjects,
			restore: true
		});
	}
}
