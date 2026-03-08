type cellCalculationProps = { charWidth: number; charHeight: number; cellX: number; cellY: number };

export const cellToWorld = ({ charWidth, charHeight, cellX, cellY }: cellCalculationProps) => {
	return { x: cellX * charWidth, y: cellY * charHeight };
};
export const worldToCell = (
	{ charWidth, charHeight }: { charWidth: number; charHeight: number },
	x: number,
	y: number
) => {
	return { x: Math.floor(x / charWidth), y: Math.floor(y / charHeight) };
};
