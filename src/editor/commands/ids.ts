export const EditorCommand = {
	ClipboardCut: 'clipboard.cut',
	ClipboardCopy: 'clipboard.copy',
	ClipboardPaste: 'clipboard.paste',
	ClipboardDuplicate: 'clipboard.duplicate',

	ArrangeBringToFront: 'arrange.bring-to-front',
	ArrangeBringForward: 'arrange.bring-forward',
	ArrangeSendBackward: 'arrange.send-backward',
	ArrangeSendToBack: 'arrange.send-to-back',

	SelectionDelete: 'selection.delete',
	SelectAll: 'select.all',
	SelectDeselect: 'select.deselect',
	SelectInverse: 'select.inverse',

	TransformRotate: 'transform.rotate',
	TransformFlipHorizontal: 'transform.flip.horizontal',
	TransformFlipVertical: 'transform.flip.vertical',

	ObjectCommit: 'object.commit',
	ObjectCancel: 'object.cancel',

	ViewToggleUI: 'view.toggle-ui',
	ViewToggleGrid: 'view.toggle-grid',
	ViewThemeSet: 'view.theme.set',
	ViewShowContextMenu: 'view.show-context-menu',

	LayerGroup: 'layer.group',
	LayerUngroup: 'layer.ungroup'
} as const;

export type EditorCommandId = (typeof EditorCommand)[keyof typeof EditorCommand];
