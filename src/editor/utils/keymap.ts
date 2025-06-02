import { VimKeyMapper } from './hotkey';

export class KeyMap {
	static set(keymap: string, cb: (e: KeyboardEvent) => void) {
		window.addEventListener('keydown', (e) => {
			if (VimKeyMapper.normalizeKeyEvent(e) === keymap) {
				cb(e);
			}
		});
	}

	static check(keymap: string, e: KeyboardEvent) {
		return VimKeyMapper.normalizeKeyEvent(e) === keymap;
	}

	static intercept(keymap: string, cb: (e: KeyboardEvent) => void) {
		return (e: KeyboardEvent) => {
			if (KeyMap.check(keymap, e)) {
				cb(e);
			}
		};
	}
}
