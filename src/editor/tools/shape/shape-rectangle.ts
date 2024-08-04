import { Shape } from "./shape";


export class Rectangle extends Shape {
  toString(): string {
    const startX = Math.min(this.startCol, this.currentCol);
    const endX = Math.max(this.startCol, this.currentCol);
    const startY = Math.min(this.startRow, this.currentRow);
    const endY = Math.max(this.startRow, this.currentRow);

    const width = endX - startX + 1;
    const height = endY - startY + 1;

    let rectangleStr = "";

    for (let rowIndex = 0; rowIndex < height; rowIndex++) {
      let rowStr = "";

      for (let colIndex = 0; colIndex < width; colIndex++) {
        if (rowIndex === 0 && colIndex === 0) {
          rowStr += '┌';
        } else if (rowIndex === 0 && colIndex === width - 1) {
          rowStr += '┐';
        } else if (rowIndex === height - 1 && colIndex === 0) {
          rowStr += '└';
        } else if (rowIndex === height - 1 && colIndex === width - 1) {
          rowStr += '┘';
        } else if (rowIndex === 0 || rowIndex === height - 1) {
          rowStr += '─';
        } else if (colIndex === 0 || colIndex === width - 1) {
          rowStr += '│';
        } else {
          rowStr += ' ';
        }
      }

      rectangleStr += rowStr + (rowIndex < height - 1 ? '\n' : '');
    }

    return rectangleStr;
  }

  area() {
    const startX = Math.min(this.startCol, this.currentCol);
    const endX = Math.max(this.startCol, this.currentCol);
    const startY = Math.min(this.startRow, this.currentRow);
    const endY = Math.max(this.startRow, this.currentRow);

    return { startX, startY, endX, endY }
  }

  endDraw(): void {
    super.endDraw();
  }
}


