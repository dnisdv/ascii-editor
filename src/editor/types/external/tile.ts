export type TilePoint = {
	x: number;
	y: number;
	char: string;
	tile: {
		x: number;
		y: number;
	};
};

export type ITileModel = {
	x: number;
	y: number;
	data: string;
};
