import { AsciiRenderMode } from './canvas/strategies/ascii-rendering.type';
import { EventEmitter } from './event-emitter';

type Events = {
	changed: never;
};

type NormalizedRGBA = [number, number, number, number];

export interface ConfigTheme {
	background: NormalizedRGBA;
	grid: NormalizedRGBA;
	foreground: NormalizedRGBA;
	primary: NormalizedRGBA;
}

export class Config extends EventEmitter<Events> {
	tileSize = 25;
	private renderingMode: AsciiRenderMode = AsciiRenderMode.DEFAULT;

	private theme: ConfigTheme = {
		background: [0.3, 0.3, 0.3, 0.3],
		grid: [0.3, 0.3, 0.3, 0.3],
		foreground: [1, 1, 1, 1.0],
		primary: [1.26, 1.45, 1.74, 0.5]
	};

	private _changed() {
		this.emit('changed');
	}

	setTileSize(tileSize: number): void {
		this.tileSize = tileSize;
		this._changed();
	}

	getTheme(): ConfigTheme {
		return this.theme;
	}

	getRenderingMode() {
		return this.renderingMode;
	}

	setRenderingMode(mode: AsciiRenderMode): void {
		if (this.renderingMode !== mode) {
			this.renderingMode = mode;
			this._changed();
		}
	}

	setTheme(theme: ConfigTheme) {
		this.theme = theme;
		this._changed();
	}
}
