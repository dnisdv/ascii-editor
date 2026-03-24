export type RotationStep = 90 | -90 | 180 | 270 | -270;

function padLines(lines: string[], width: number): string[] {
	return lines.map((l) => l.padEnd(width, ' '));
}

export function rotateText(text: string, degrees: RotationStep): string {
	const rawLines = text.split('\n');
	while (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') rawLines.pop();
	if (rawLines.length === 0) return text;

	const cols = Math.max(...rawLines.map((l) => l.length), 1);
	const lines = padLines(rawLines, cols);
	const rows = lines.length;

	const norm = ((degrees % 360) + 360) % 360;

	if (norm === 90) {
		const grid = Array.from({ length: cols }, () => Array<string>(rows).fill(' '));
		for (let i = 0; i < rows; i++)
			for (let j = 0; j < cols; j++) grid[j][rows - 1 - i] = lines[i][j] ?? ' ';
		return grid.map((r) => r.join('')).join('\n');
	}

	if (norm === 270) {
		const grid = Array.from({ length: cols }, () => Array<string>(rows).fill(' '));
		for (let i = 0; i < rows; i++)
			for (let j = 0; j < cols; j++) grid[cols - 1 - j][i] = lines[i][j] ?? ' ';
		return grid.map((r) => r.join('')).join('\n');
	}

	if (norm === 180) {
		const grid = Array.from({ length: rows }, () => Array<string>(cols).fill(' '));
		for (let i = 0; i < rows; i++)
			for (let j = 0; j < cols; j++) grid[rows - 1 - i][cols - 1 - j] = lines[i][j] ?? ' ';
		return grid.map((r) => r.join('')).join('\n');
	}

	return text;
}
