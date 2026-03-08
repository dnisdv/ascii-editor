export interface WorldRegion {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface CellRectangle {
	cellX: number;
	cellY: number;
	width: number;
	height: number;
}

export function createCellRectangle({
	cellX,
	cellY,
	width,
	height
}: {
	cellX: number;
	cellY: number;
	width: number;
	height: number;
}): CellRectangle {
	return { cellX: Math.floor(cellX), cellY: Math.floor(cellY), width, height };
}

export function createWorldRegion(
	x: number,
	y: number,
	width: number,
	height: number
): WorldRegion {
	return { x, y, width, height };
}
