import type { ITile, RegionOptions, SerializedTile } from './types';

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

		this.data = this.data.substring(0, index) + char + this.data.substring(index + 1);
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

		for (let row = 0; row < lines.length; row++) {
			const line = lines[row];
			for (let col = 0; col < line.length; col++) {
				const char = line[col];

				if (skipSpaces && char === ' ') {
					continue;
				}
				this.setChar(offsetX + col, offsetY + row, char);
			}
		}
	}

	fillRegion(offsetX: number, offsetY: number, width: number, height: number, char: string): void {
		for (let row = 0; row < height; row++) {
			for (let col = 0; col < width; col++) {
				this.setChar(offsetX + col, offsetY + row, char);
			}
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

	serialize(): SerializedTile {
		return {
			tileSize: this.tileSize,
			x: this.x,
			y: this.y,
			data: this.data
		};
	}

	static deserialize(data: SerializedTile): ITile {
		const tile = new Tile(data.tileSize, data.x, data.y, data.data);
		return tile;
	}
}
