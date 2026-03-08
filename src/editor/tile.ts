import type { ITile, RegionOptions, TileSchemaType } from './types';
import { isAllowedSingleCellChar } from '@editor/utils/char-policy';

export class Tile implements ITile {
	constructor(
		public tileSize: number,
		public x: number,
		public y: number,
		public data: string = ''
	) {
		this.data = this.data || ' '.repeat(this.tileSize * this.tileSize);
	}

	setChar(localX: number, localY: number, char: string): void {
		const innerX = ((localX % this.tileSize) + this.tileSize) % this.tileSize;
		const innerY = ((localY % this.tileSize) + this.tileSize) % this.tileSize;
		const index = innerY * this.tileSize + innerX;

		if (index < 0 || index >= this.data.length) {
			return;
		}

		const safeChar = isAllowedSingleCellChar(char) ? char[0] : ' ';
		this.data = this.data.substring(0, index) + safeChar + this.data.substring(index + 1);
	}

	getChar(localX: number, localY: number): string | null {
		const innerX = ((localX % this.tileSize) + this.tileSize) % this.tileSize;
		const innerY = ((localY % this.tileSize) + this.tileSize) % this.tileSize;
		const index = innerY * this.tileSize + innerX;

		if (index < 0 || index >= this.data.length) {
			return null;
		}

		return this.data[index];
	}

	setRegion(offsetX: number, offsetY: number, lines: string[], options: RegionOptions = {}): void {
		const { skipSpaces = true } = options;

		if (skipSpaces === false) {
			for (let r = 0; r < lines.length; r++) {
				const line = lines[r];
				if (!line) continue;
				const rowIndex = offsetY + r;
				if (rowIndex < 0 || rowIndex >= this.tileSize) continue;
				const colStart = Math.max(0, Math.min(this.tileSize, offsetX));
				const frag = line;
				let sanitized = '';
				for (let i = 0; i < frag.length; i++) {
					const ch = frag[i];
					sanitized += isAllowedSingleCellChar(ch) ? ch[0] : ' ';
				}
				const maxLen = this.tileSize - colStart;
				if (sanitized.length > maxLen) sanitized = sanitized.substring(0, maxLen);
				const rowAbsStart = rowIndex * this.tileSize;
				const sliceStart = rowAbsStart + colStart;
				const sliceEnd = sliceStart + sanitized.length;
				this.data = this.data.substring(0, sliceStart) + sanitized + this.data.substring(sliceEnd);
			}
			return;
		}

		for (let row = 0; row < lines.length; row++) {
			const line = lines[row];
			for (let col = 0; col < line.length; col++) {
				const char = line[col];
				if (skipSpaces && char === ' ') continue;
				this.setChar(offsetX + col, offsetY + row, char);
			}
		}
	}

	fillRegion(offsetX: number, offsetY: number, width: number, height: number, char: string): void {
		const safeChar = isAllowedSingleCellChar(char) ? char[0] : ' ';
		for (let r = 0; r < height; r++) {
			const rowIndex = offsetY + r;
			if (rowIndex < 0 || rowIndex >= this.tileSize) continue;
			const colStart = Math.max(0, Math.min(this.tileSize, offsetX));
			const maxLen = Math.max(0, Math.min(this.tileSize - colStart, width));
			if (maxLen <= 0) continue;
			const fill = safeChar.repeat(maxLen);
			const rowAbsStart = rowIndex * this.tileSize;
			const sliceStart = rowAbsStart + colStart;
			const sliceEnd = sliceStart + maxLen;
			this.data = this.data.substring(0, sliceStart) + fill + this.data.substring(sliceEnd);
		}
	}

	toString(): string {
		let result = '';
		for (let i = 0; i < this.tileSize; i++) {
			result += this.data.substring(i * this.tileSize, (i + 1) * this.tileSize);
			if (i < this.tileSize - 1) {
				result += '\n';
			}
		}
		return result;
	}

	query(x: number, y: number, width: number, height: number): string {
		const startRow = Math.max(0, y);
		const endRow = Math.min(this.tileSize, y + height);

		if (startRow >= endRow || x >= this.tileSize || x + width <= 0) {
			return '';
		}

		const startCol = Math.max(0, x);
		const endCol = Math.min(this.tileSize, x + width);

		const rows = Array.from({ length: endRow - startRow }, (_, index) => {
			const rowIndex = startRow + index;
			const start = rowIndex * this.tileSize + startCol;
			const end = rowIndex * this.tileSize + endCol;
			return this.data.substring(start, end);
		});
		return rows.join('\n');
	}

	isEmpty(): boolean {
		return this.data.trim().length === 0;
	}

	serialize(): TileSchemaType {
		return {
			tileSize: this.tileSize,
			x: this.x,
			y: this.y,
			data: this.data
		};
	}

	static deserialize(data: TileSchemaType): ITile {
		const tile = new Tile(data.tileSize, data.x, data.y, data.data);
		return tile;
	}
}
