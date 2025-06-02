import type { CanvasKit, FontMgr } from 'canvaskit-wasm';
import { EventEmitter } from './event-emitter';

export interface CharDimensions {
	width: number;
	height: number;
}

export interface FontMetrics {
	size: number;
	lineHeight: number;
	dimensions: CharDimensions;
}

export interface FontConfig {
	family: string;
	size: number;
	weight?: string;
	style?: string;
}

export interface FontData {
	buffer: ArrayBuffer;
	family: string;
}

type FontEvents = {
	changed: FontMetrics;
};

export class Font extends EventEmitter<FontEvents> {
	private config: FontConfig = {
		family: '',
		size: 18,
		weight: 'normal',
		style: 'normal'
	};

	private metrics: FontMetrics = {
		size: 18,
		lineHeight: 0,
		dimensions: {
			width: 0,
			height: 0
		}
	};

	constructor(
		private canvasKit: CanvasKit,
		private fontMgr: FontMgr,
		initialConfig?: Partial<FontConfig>
	) {
		super();

		if (initialConfig) {
			this.updateConfig(initialConfig);
		}
	}

	updateConfig(config: Partial<FontConfig>): void {
		this.config = {
			...this.config,
			...config
		};

		this.recalculateMetrics();
	}

	getConfig(): FontConfig {
		return { ...this.config };
	}

	getMetrics(): FontMetrics {
		return { ...this.metrics };
	}

	private recalculateMetrics(): void {
		const dimensions = this.measureChar('M', this.config);

		this.metrics = {
			size: this.config.size,
			lineHeight: Math.ceil(dimensions.height * 1.2),
			dimensions
		};

		this.emit('changed', this.metrics);
	}

	private measureChar(char: string, config: FontConfig): CharDimensions {
		const textStyle = new this.canvasKit.TextStyle({
			color: this.canvasKit.Color4f(0, 0, 0, 1.0),
			fontFamilies: [config.family],
			fontSize: config.size,
			fontStyle: {}
		});

		const paraStyle = new this.canvasKit.ParagraphStyle({
			textStyle: textStyle,
			textAlign: this.canvasKit.TextAlign.Left
		});

		const builder = this.canvasKit.ParagraphBuilder.Make(paraStyle, this.fontMgr);
		builder.addText(char);
		const paragraph = builder.build();
		paragraph.layout(1000);

		return {
			width: paragraph.getMinIntrinsicWidth(),
			height: paragraph.getHeight()
		};
	}
}
