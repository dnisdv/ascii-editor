import { describe, it, expect, beforeEach } from 'vitest';
import { TextGridObject } from './text-grid-object';
import { Config } from '@editor/config';
import type { ITile } from '@editor/types';

describe('TextGridObject', () => {
	let textGrid: TextGridObject;
	let config: Config;

	beforeEach(() => {
		config = new Config();
		config.setTileSize(10);
		textGrid = new TextGridObject(config);
	});

	describe('Character Manipulation', () => {
		it('should set and get a character at a specific cell', () => {
			textGrid.setChar(5, 5, 'A');
			expect(textGrid.getChar(5, 5)).toBe('A');
		});

		it('should return a space for an empty cell', () => {
			expect(textGrid.getChar(1, 1)).toBe(' ');
		});

		it('should update an existing character', () => {
			textGrid.setChar(2, 3, 'B');
			textGrid.setChar(2, 3, 'C');
			expect(textGrid.getChar(2, 3)).toBe('C');
		});

		it('should handle setting a character to a space by removing it from the tile', () => {
			textGrid.setChar(7, 8, 'D');
			const tile = textGrid.getTileAtPosition(7, 8) as ITile;
			expect(tile).not.toBeNull();
			expect(tile.isEmpty()).toBe(false);

			textGrid.setChar(7, 8, ' ');
			expect(textGrid.getChar(7, 8)).toBe(' ');
			expect(textGrid.getTileAtPosition(7, 8)).toBeNull();
		});

		it('should handle setting a character at negative coordinates', () => {
			textGrid.setChar(-1, -1, 'Z');
			expect(textGrid.getChar(-1, -1)).toBe('Z');
		});
	});

	describe('Region Manipulation', () => {
		it('should set a region of text and read it back', () => {
			const text = 'Hello\nWorld';
			textGrid.setToRegion(2, 2, text);
			const result = textGrid.readRegion(2, 2, 5, 2);
			expect(result).toBe(text);
		});

		it('should correctly handle multi-line strings with different lengths', () => {
			const text = 'Line1\nLine22\nLine333';
			textGrid.setToRegion(0, 0, text);
			const result = textGrid.readRegion(0, 0, 7, 3);
			expect(result).toBe('Line1  \nLine22 \nLine333');
		});

		it('should clear a specified region', () => {
			const text = 'ABC\nDEF';
			textGrid.setToRegion(1, 1, text);
			textGrid.clearRegion(2, 1, 2, 2);
			const result = textGrid.readRegion(1, 1, 3, 2);
			expect(result).toBe('A  \nD  ');
		});

		it('should fill a region with a specified character', () => {
			textGrid.fillRegion(3, 4, 3, 2, '*');
			const result = textGrid.readRegion(3, 4, 3, 2);
			expect(result).toBe('***\n***');
		});
	});

	describe('Tile Querying', () => {
		beforeEach(() => {
			textGrid.setChar(5, 5, 'A');
			textGrid.setChar(15, 5, 'B');
			textGrid.setChar(5, 15, 'C');
			textGrid.setChar(15, 15, 'D');
		});
		it('should query tiles within a given rectangle', () => {
			const tiles = textGrid.queryTiles(0, 0, 2, 2);
			expect(tiles.length).toBe(4);
		});

		it('should return all tiles with queryAllTiles', () => {
			const tiles = textGrid.queryAllTiles();
			expect(tiles.length).toBe(4);
		});

		it('should get a tile at a specific cell position', () => {
			const tile = textGrid.getTileAtPosition(5, 5);
			expect(tile).not.toBeNull();
			expect(tile?.x).toBe(0);
			expect(tile?.y).toBe(0);
		});

		it('should return null for a position with no tile', () => {
			const tile = textGrid.getTileAtPosition(100, 100);
			expect(tile).toBeNull();
		});
	});

	describe('Edge cases', () => {
		it('should handle setting and getting characters at the edge of tiles', () => {
			textGrid.setChar(9, 9, 'A');
			textGrid.setChar(10, 10, 'B');
			expect(textGrid.getChar(9, 9)).toBe('A');
			expect(textGrid.getChar(10, 10)).toBe('B');
			const tiles = textGrid.queryAllTiles();
			expect(tiles.length).toBe(2);
			expect(tiles[0].x === 0 && tiles[0].y === 0).toBe(true);
			expect(tiles[1].x === 1 && tiles[1].y === 1).toBe(true);
		});

		it('should handle clearing the entire grid', () => {
			textGrid.setChar(1, 1, 'A');
			textGrid.clear();
			expect(textGrid.queryAllTiles().length).toBe(0);
			expect(textGrid.getChar(1, 1)).toBe(' ');
		});
	});
});
