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
		greater: '>',
		backslash: '\\',
		quote: "'",
		apostrophe: "'"
	};

	private static codeToKey(code: string): string | null {
		if (code.startsWith('Key')) return code.slice(3).toLowerCase();
		if (code.startsWith('Digit')) return code.slice(5);
		const map: Record<string, string> = {
			BracketLeft: '[',
			BracketRight: ']',
			Backslash: '\\',
			Quote: "'",
			Semicolon: ';',
			Comma: ',',
			Period: '.',
			Slash: '/',
			Minus: '-',
			Equal: '=',
			Backquote: '`'
		};
		return map[code] ?? null;
	}

	public static normalizeKeyEvent(event: KeyboardEvent): string {
		const { key, code, altKey, ctrlKey, metaKey, shiftKey } = event;
		const hasModifier = ctrlKey || altKey || metaKey;
		let baseKey = hasModifier ? (this.codeToKey(code) ?? key) : key;
		if (hasModifier && shiftKey && baseKey.length === 1 && /[a-z]/.test(baseKey)) {
			baseKey = baseKey.toUpperCase();
		}
		const normalizedKey = this.aliases[baseKey.toLowerCase()] || baseKey;

		let vimNotation = '';
		if (ctrlKey) vimNotation += 'C-';
		if (altKey) vimNotation += 'A-';
		if (shiftKey) vimNotation += 'S-';
		if (metaKey) vimNotation += 'M-';

		vimNotation += normalizedKey;

		return `<${vimNotation}>`;
	}
}
