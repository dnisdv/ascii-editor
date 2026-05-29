import type { CoreApi } from '@editor/core';
import type { EditorCommands } from './command-registry';
import { EditorCommand } from './ids';

interface ContextMenuArgs {
	contextMenuPosition?: { x: number; y: number };
}

export function registerDefaultCommands(registry: EditorCommands, core: CoreApi): void {
	registry.register(EditorCommand.ObjectCommit, () => {
		core.getSelectionManager().commitSelection();
	});

	registry.register(EditorCommand.ClipboardCopy, () => core.getClipboardManager().copy());
	registry.register(EditorCommand.ClipboardCut, () => core.getClipboardManager().cut());
	registry.register(EditorCommand.ClipboardPaste, (args: unknown) => {
		const ctxPos = (args as ContextMenuArgs)?.contextMenuPosition;
		const mousePos = ctxPos ??
			core.getToolManager().toolEventManager.getLastMousePosition() ?? { x: 0, y: 0 };
		const worldPos = core.getCamera().screenToWorldRaw(mousePos.x, mousePos.y);
		const { width, height } = core.getFontManager().getMetrics().dimensions;
		const gridX = Math.floor(worldPos.x / width);
		const gridY = Math.floor(worldPos.y / height);
		void core.getClipboardManager().paste(gridX, gridY);
	});
	registry.register(EditorCommand.ClipboardDuplicate, (args: unknown) => {
		core.getClipboardManager().copy();
		const ctxPos = (args as ContextMenuArgs)?.contextMenuPosition;

		const mousePos = ctxPos ??
			core.getToolManager().toolEventManager.getLastMousePosition() ?? { x: 0, y: 0 };
		const worldPos = core.getCamera().screenToWorldRaw(mousePos.x, mousePos.y);

		const { width, height } = core.getFontManager().getMetrics().dimensions;

		const gridX = Math.floor(worldPos.x / width);
		const gridY = Math.floor(worldPos.y / height);

		void core.getClipboardManager().paste(gridX + 1, gridY + 1);
	});

	registry.register(EditorCommand.SelectAll, () => core.getSelectionManager().selectAll());

	registry.register(EditorCommand.ArrangeBringToFront, () =>
		core.getSelectionManager().bringToFront()
	);
	registry.register(EditorCommand.ArrangeSendToBack, () => core.getSelectionManager().sendToBack());
	registry.register(EditorCommand.ArrangeBringForward, () =>
		core.getSelectionManager().bringForward()
	);
	registry.register(EditorCommand.ArrangeSendBackward, () =>
		core.getSelectionManager().sendBackward()
	);

	registry.register(EditorCommand.SelectionDelete, () => {
		core.getSelectionManager().removeSelection();
	});

	registry.register(EditorCommand.LayerGroup, () => {
		const layersManager = core.getLayersManager();
		let ids = layersManager.getSelectedLayerIds();
		const activeId = layersManager.getActiveLayerKey();

		if (ids.length === 0) {
			if (activeId) ids = [activeId];
		} else if (activeId && !ids.includes(activeId)) {
			ids = [activeId, ...ids];
		}

		if (ids.length === 0) return;

		const group = layersManager.groupLayers(ids);
		if (group) {
			layersManager.clearLayerSelection();
		}
	});

	registry.register(EditorCommand.LayerRasterize, () => {
		const session = core.getSelectionManager().getActiveSession();
		if (!session || session.isEmpty()) return;

		const sourceLayerId = session.getSourceLayerId();
		const rasterizable = session
			.getSelectedObjects()
			.filter(
				(obj) =>
					obj.type !== 'text-grid' &&
					obj.type !== 'text-selection'
			);

		if (rasterizable.length === 0) return;

		const historyManager = core.getHistoryManager();
		const batchId = historyManager.beginBatch();

		core.getSelectionManager().commitSelection(batchId);

		for (let i = rasterizable.length - 1; i >= 0; i--) {
			core.getLayersManager().rasterizeObject(sourceLayerId, rasterizable[i].id, batchId);
		}

		historyManager.commitBatch(batchId);
	});

	registry.register(EditorCommand.LayerUngroup, () => {
		const layersManager = core.getLayersManager();
		let ids = layersManager.getSelectedLayerIds();
		const activeId = layersManager.getActiveLayerKey();
		if (ids.length === 0) {
			if (activeId) ids = [activeId];
		} else if (activeId && !ids.includes(activeId)) {
			ids = [activeId, ...ids];
		}

		const groupIds = new Set<string>();
		for (const id of ids) {
			const layer = layersManager.getRealLayer(id);
			if (layer?.groupId) groupIds.add(layer.groupId);
		}

		for (const gid of groupIds) {
			layersManager.removeGroup(gid, false);
		}

		layersManager.clearLayerSelection();
	});
}
