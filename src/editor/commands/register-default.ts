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
}
