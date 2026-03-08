import type { ISessionManagerCommand, ISessionManagerCommandDeps } from './type';
import type { CellRectangle } from '@editor/types';
import { findObjectsInRegion } from './utils';
import type { LayersManager } from '@editor/layers/layers-manager';
import type { HistoryManager } from '@editor/history-manager';
import type { SelectionSessionManager } from '../selection-session-manager';
import { sessionAppendRegion } from '@editor/select/history/session-append-region';
import { sessionSelect } from '@editor/select/history/session-select';

type AppendRegionDeps = {
	layersManager: LayersManager;
	historyManager: HistoryManager;
};

type AppendRegionPayload = {
	region: CellRectangle;
	sourceLayerId: string;
};

export class AppendRegionCommand implements ISessionManagerCommand {
	constructor(
		private deps: AppendRegionDeps,
		private region: AppendRegionPayload['region']
	) {}

	private normalizeRect(rect: CellRectangle): CellRectangle {
		const x = rect.width < 0 ? rect.cellX + rect.width : rect.cellX;
		const y = rect.height < 0 ? rect.cellY + rect.height : rect.cellY;
		const widthAbs = Math.abs(rect.width);
		const heightAbs = Math.abs(rect.height);

		const width = widthAbs === 0 ? 1 : widthAbs;
		const height = heightAbs === 0 ? 1 : heightAbs;
		return { cellX: x, cellY: y, width, height };
	}

	public execute(_: ISessionManagerCommandDeps, manager: SelectionSessionManager): void {
		const activeLayerId = this.deps.layersManager.getActiveLayerKey();
		if (!activeLayerId) return;

		const activeLayer = this.deps.layersManager.getActiveLayer();
		if (!activeLayer) return;

		const normalized = this.normalizeRect(this.region);
		const foundObjects = findObjectsInRegion(normalized, activeLayer, null);

		const session = manager.getActiveSession();
		if (!session) {
			this.deps.historyManager.execute(sessionSelect, 'select::session', {
				objects: foundObjects,
				restore: true
			});
			return;
		}

		this.deps.historyManager.execute(sessionAppendRegion, 'select::session', {
			objects: foundObjects
		});
	}
}
