export function findRectangleAreaInString(
  gridString: string
): { start: [number, number]; end: [number, number] } | null {
  const lines = gridString.split('\n');
  const numRows = lines.length;
  if (numRows === 0) {
    return null;
  }

  const numCols = lines[0].length;
  for (const line of lines) {
    if (line.length !== numCols) {
      return null;
    }
  }

  let top = Infinity;
  let left = Infinity;
  let bottom = -Infinity;
  let right = -Infinity;

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      if (lines[r][c] !== '.' && lines[r][c] !== ' ') {
        if (r < top) top = r;
        if (c < left) left = c;
        if (r > bottom) bottom = r;
        if (c > right) right = c;
      }
    }
  }

  if (top === Infinity || left === Infinity || bottom === -Infinity || right === -Infinity) {
    return null;
  }

  return {
    start: [left, top],
    end: [right, bottom],
  };
}

