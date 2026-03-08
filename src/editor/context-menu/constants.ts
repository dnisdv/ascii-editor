export const MenuGroup = {
	Clipboard: 'clipboard',
	Selection: 'selection',
	Transform: 'transform',
	View: 'view',
	Edit: 'edit',
	Object: 'object',
	Layer: 'layer',
	Align: 'align',
	Arrange: 'arrange',
	Destroy: 'destroy'
} as const;
export type MenuGroupKey = (typeof MenuGroup)[keyof typeof MenuGroup];

export const MenuId = {
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

	ObjectCommit: 'object.commit',
	ObjectCancel: 'object.cancel',

	TransformRotate: 'transform.rotate',
	TransformRotate90: 'transform.rotate.90',
	TransformRotateNeg90: 'transform.rotate.-90',
	TransformRotate180: 'transform.rotate.180',
	TransformFlipHorizontal: 'transform.flip.horizontal',
	TransformFlipVertical: 'transform.flip.vertical',

	ViewToggleUI: 'view.toggle-ui',
	ViewToggleGrid: 'view.toggle-grid',
	ViewTheme: 'view.theme',
	ViewThemeSet: 'view.theme.set',
	ViewThemeLight: 'view.theme.light',
	ViewThemeDark: 'view.theme.dark'
} as const;
export type MenuIdKey = (typeof MenuId)[keyof typeof MenuId];

export const Keybindings: Record<string, string | string[]> = {
	[MenuId.ClipboardCut]: '<C-x>',
	[MenuId.ClipboardCopy]: '<C-c>',
	[MenuId.ClipboardPaste]: '<C-v>',
	[MenuId.ClipboardDuplicate]: '<C-d>',
	[MenuId.SelectAll]: '<C-a>',
	[MenuId.SelectionDelete]: ['<Delete>', '<Backspace>'],
	[MenuId.ArrangeBringToFront]: '<]>',
	[MenuId.ArrangeBringForward]: '<C-]>',
	[MenuId.ArrangeSendBackward]: '<C-[>',
	[MenuId.ArrangeSendToBack]: '<[>',
	[MenuId.ViewToggleUI]: ['<C-\\>', '<C-Backslash>'],
	[MenuId.ViewToggleGrid]: ["<C-'>", '<C-Quote>']
};

export function getShortcutDisplay(id: string): string | undefined {
	const val = Keybindings[id];
	if (!val) return undefined;

	const key = Array.isArray(val) ? val[0] : val;

	const content = key.replace(/^<|>$/g, '');

	const parts = content.split('-');
	const last = parts.pop();

	const modifiers = parts.map((p) => {
		if (p === 'C') return 'Ctrl';
		if (p === 'A') return 'Alt';
		if (p === 'S') return 'Shift';
		if (p === 'M') return 'Meta';
		return p;
	});

	let finalKey = last;
	if (last === 'Delete') finalKey = 'Del';
	else if (last && last.length === 1) finalKey = last.toUpperCase();

	return [...modifiers, finalKey].join('+');
}
