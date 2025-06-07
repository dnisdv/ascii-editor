import type { IAsciiRenderingStrategy } from './ascii-rendering-strategy';
import { AsciiRenderMode } from './ascii-rendering.type';
import { AsciiRenderDefaultStrategy } from './layer-default-strategy';
import { AsciiRenderFocusStrategy } from './layer-focus-strategy';

export class AsciiStrategyFactory {
	public static create(mode: AsciiRenderMode): IAsciiRenderingStrategy {
		switch (mode) {
			case AsciiRenderMode.FOCUS_MODE:
				return new AsciiRenderFocusStrategy();
			case AsciiRenderMode.DEFAULT:
			default:
				return new AsciiRenderDefaultStrategy();
		}
	}
}
