export interface ITileMap {
	tileSize: number;
	isEmpty(): boolean;
	addTile(x: number, y: number): ITile;
	queryAll(): ITile[];
	queryAllKeys(): string[];
	query(x: number, y: number, width: number, height: number): ITile[];
	getOrCreateTile(x: number, y: number): ITile;
	getChar(x: number, y: number): string;
	readRegion(startX: number, startY: number, width: number, height: number): string;

	removeTile(x: number, y: number): void;
	getTile(x: number, y: number): ITile | null;
	createTileBoundary(
		x: number,
		y: number
	): {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	clear(): void;
}

export interface ITileData {
	x: number;
	y: number;
	char: string;
}

export interface RegionOptions {
	skipSpaces?: boolean;
}

export interface ITile {
	tileSize: number;
	x: number;
	y: number;
	data: string;
	setChar(x: number, y: number, char: string): void;
	getChar(x: number, y: number): string | null;
	toString(): string;
	query(x: number, y: number, width: number, height: number): string;

	fillRegion(offsetX: number, offsetY: number, width: number, height: number, char: string): void;
	setRegion(offsetX: number, offsetY: number, lines: string[], options?: RegionOptions): void;
	isEmpty(): boolean;
}

export interface ISpatialHashMap<T> {
	add(x: number, y: number, item: T): void;
	query(x: number, y: number, width: number, height: number): T[];
	queryAll(): T[];
	remove(x: number, y: number): void;
}
