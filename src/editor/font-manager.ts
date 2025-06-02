import type { CanvasKit, FontMgr } from 'canvaskit-wasm';
import { EventEmitter } from './event-emitter';
import { Font, type FontConfig, type FontData, type FontMetrics } from './font';

type FontManagerEvents = {
	'font:changed': Font;
	'metrics:changed': FontMetrics;
};

export class FontManager extends EventEmitter<FontManagerEvents> {
	private currentFont: Font;
	private currentFontMgr: FontMgr;

	constructor(
		private canvasKit: CanvasKit,
		private fontData: FontData,
		private initialConfig?: Partial<FontConfig>
	) {
		super();

		const fontMgr = this.createFontManager(this.fontData.buffer);
		this.currentFontMgr = fontMgr;
		this.currentFont = this.createFont(fontMgr, fontData.family, this.initialConfig);
		this.currentFont.on('changed', (metrics) => {
			this.emit('metrics:changed', metrics);
		});
	}

	getFontMgr(): FontMgr {
		return this.currentFontMgr;
	}

	async loadFont(fontData: FontData): Promise<void> {
		const fontMgr = this.createFontManager(fontData.buffer);
		const newFont = this.createFont(fontMgr, fontData.family, {
			size: this.currentFont.getConfig().size
		});

		this.currentFont = newFont;
		this.currentFont.on('changed', (metrics) => {
			this.emit('metrics:changed', metrics);
		});

		this.emit('font:changed', this.currentFont);
	}

	getCurrentFont(): Font {
		return this.currentFont;
	}

	updateConfig(config: Partial<FontConfig>): void {
		this.currentFont.updateConfig(config);
	}

	getMetrics(): FontMetrics {
		return this.currentFont.getMetrics();
	}

	private createFontManager(buffer: ArrayBuffer): FontMgr {
		const fontMgr = this.canvasKit.FontMgr.FromData(buffer);
		if (!fontMgr) {
			throw new Error('Could not create font manager from provided font data');
		}
		return fontMgr;
	}

	private createFont(fontMgr: FontMgr, family: string, config?: Partial<FontConfig>): Font {
		return new Font(this.canvasKit, fontMgr, {
			family,
			...config
		});
	}
}
