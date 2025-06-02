export class VimKeyMapper {
	private static aliases: { [key: string]: string } = {
		left: 'ArrowLeft',
		right: 'ArrowRight',
		up: 'ArrowUp',
		down: 'ArrowDown',
		bs: 'Backspace',
		menu: 'ContextMenu',
		apps: 'ContextMenu',
		del: 'Delete',
		return: 'Enter',
		cr: 'Enter',
		esc: 'Escape',
		pgup: 'PageUp',
		pgdn: 'PageDown',
		lt: '<',
		less: '<',
		lesser: '<',
		gt: '>',
		greater: '>'
	};

	public static normalizeKeyEvent(event: KeyboardEvent): string {
		const { key, altKey, ctrlKey, metaKey, shiftKey } = event;
		const normalizedKey = this.aliases[key.toLowerCase()] || key;

		let vimNotation = '';
		if (ctrlKey) vimNotation += 'C-';
		if (altKey) vimNotation += 'A-';
		if (shiftKey) vimNotation += 'S-';
		if (metaKey) vimNotation += 'M-';

		vimNotation += normalizedKey;

		return `<${vimNotation}>`;
	}
}
