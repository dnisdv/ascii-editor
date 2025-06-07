import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Layer, defaultLayerConfig, type LayerOptions } from './layer';
import { Tile } from '../tile';
import { BaseBusLayers } from '../bus-layers';
import type { DeepPartial, ILayerModel } from '@editor/types';
import { TileMap } from '@editor/tileMap';

const TILE_SIZE = 25;

describe('Layer', () => {
	let layer: Layer;
	let tileMap: TileMap;
	let mockLayersBus: BaseBusLayers;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let layerEmitSpy: ReturnType<typeof vi.spyOn> & any;

	const layerOptionsBase: Omit<LayerOptions, 'tileMap' | 'layersBus'> = {
		id: 'test-layer-id',
		name: 'Test Layer',
		index: 0,
		opts: { ...defaultLayerConfig }
	};

	beforeEach(() => {
		tileMap = new TileMap({ tileSize: TILE_SIZE });
		mockLayersBus = new BaseBusLayers();
		vi.spyOn(mockLayersBus, 'emit');

		layer = new Layer({
			...layerOptionsBase,
			tileMap,
			layersBus: mockLayersBus
		});
		layerEmitSpy = vi.spyOn(layer, 'emit');
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Layer Initialization and Configuration', () => {
		it('should be correctly configured with provided identity, naming, order, and default visual/interaction settings upon creation', () => {
			expect(layer.id).toBe(layerOptionsBase.id);
			expect(layer.name).toBe(layerOptionsBase.name);
			expect(layer.index).toBe(layerOptionsBase.index);
			expect(layer.getOpts()).toEqual(defaultLayerConfig);
			expect(layer.tileMap).toBeInstanceOf(TileMap);
			expect(layer.bus).toBeInstanceOf(BaseBusLayers);
		});

		it('should allow customization of its visual and interaction settings during creation', () => {
			const customOpts = { visible: false, locked: true };
			const customLayer = new Layer({
				...layerOptionsBase,
				opts: customOpts,
				tileMap,
				layersBus: mockLayersBus
			});
			expect(customLayer.getOpts()).toEqual(customOpts);
		});
	});

	describe('Managing and Querying Tile Structures', () => {
		it('should expand its content area by creating a new tile at specified coordinates', () => {
			const tile = layer.addTile(1, 2);
			expect(tile).toBeInstanceOf(Tile);
			expect(tile.x).toBe(1);
			expect(tile.y).toBe(2);
			expect(tileMap.getTile(1, 2)).toBe(tile);
		});

		it('should identify all tiles based on the TileMap query logic for a given tile-indexed area', () => {
			layer.addTile(0, 0);
			layer.addTile(1, 0);
			layer.addTile(0, 1);
			layer.addTile(1, 1);
			const queriedTiles = layer.queryTiles(0, 0, 1, 1);
			expect(queriedTiles.length).toBe(4);
		});

		it('should provide unique identifiers for all tiles it currently manages', () => {
			layer.addTile(0, 0);
			layer.addTile(5, 10);
			const keys = layer.queryAllTilesKeys();
			expect(keys).toEqual(expect.arrayContaining(['0,0', '5,10']));
			expect(keys.length).toBe(2);
		});

		it('should provide access to all tiles it currently manages', () => {
			const tile1 = layer.addTile(0, 0);
			const tile2 = layer.addTile(5, 10);
			const allTiles = layer.queryAllTiles();
			expect(allTiles).toEqual(expect.arrayContaining([tile1, tile2]));
			expect(allTiles.length).toBe(2);
		});

		it('should identify the specific tile located at a given world coordinate', () => {
			const tile = layer.addTile(1, 1);
			expect(layer.getTileAtPosition(TILE_SIZE, TILE_SIZE)).toBe(tile);
			expect(layer.getTileAtPosition(TILE_SIZE * 2 - 1, TILE_SIZE * 2 - 1)).toBe(tile);
			expect(
				layer.getTileAtPosition(
					TILE_SIZE + Math.floor(TILE_SIZE / 2),
					TILE_SIZE + Math.floor(TILE_SIZE / 2)
				)
			).toBe(tile);
		});

		it('should indicate when no tile is present at a given world coordinate', () => {
			layer.addTile(1, 1);
			expect(layer.getTileAtPosition(0, 0)).toBeNull();
			expect(layer.getTileAtPosition(TILE_SIZE - 1, TILE_SIZE - 1)).toBeNull();
		});

		it('should be able to remove all its content, becoming empty', () => {
			layer.addTile(0, 0);
			layer.addTile(1, 1);
			layer.clear();
			expect(layer.queryAllTiles().length).toBe(0);
			expect(tileMap.isEmpty()).toBe(true);
		});
	});

	describe('Reading and Writing Individual Characters', () => {
		it('should reveal the character present at a specific world coordinate', () => {
			const tile = layer.addTile(0, 0);
			tile.setChar(5, 5, 'A');
			expect(layer.getChar(5, 5)).toBe('A');
		});

		it('should indicate an empty space at world coordinates where no character or tile exists', () => {
			expect(layer.getChar(5, 5)).toBe(' ');
			const tile = layer.addTile(0, 0);
			expect(layer.getChar(5, 5)).toBe(' ');
			tile.setChar(6, 6, 'B');
			expect(layer.getChar(5, 5)).toBe(' ');
		});

		describe('Modifying a single character in the layer', () => {
			it('should update the character at a world coordinate within an existing tile', () => {
				const tile = layer.addTile(0, 0);
				const charX = 5,
					charY = 5;
				layer.setChar(charX, charY, 'B');
				expect(tile.getChar(charX % TILE_SIZE, charY % TILE_SIZE)).toBe('B');
			});

			it('should automatically create a new tile to store a non-space character if placed in an empty region', () => {
				const charX = TILE_SIZE + 2,
					charY = TILE_SIZE + 2;
				layer.setChar(charX, charY, 'C');
				const newTile = tileMap.getTile(1, 1);
				expect(newTile).not.toBeNull();
				expect(newTile?.getChar(charX % TILE_SIZE, charY % TILE_SIZE)).toBe('C');
			});

			it('should remove an underlying tile if placing a space character results in the tile becoming entirely empty', () => {
				const tile = layer.addTile(0, 0);
				tile.setChar(1, 1, 'A');
				layer.setChar(1, 1, ' ');
				expect(tileMap.getTile(0, 0)).toBeNull();
			});

			it('should replace a character with a space within a tile that remains non-empty', () => {
				const tile = layer.addTile(0, 0);
				tile.setChar(1, 1, 'A');
				tile.setChar(2, 2, 'B');
				layer.setChar(1, 1, ' ');
				expect(tileMap.getTile(0, 0)).toBe(tile);
				expect(tile.getChar(1, 1)).toBe(' ');
				expect(tile.getChar(2, 2)).toBe('B');
			});

			it('should not create a new tile when attempting to place a space character in an already empty region', () => {
				const result = layer.setChar(5, 5, ' ');
				expect(tileMap.getTile(0, 0)).toBeNull();
				expect(result).toBeNull();
			});
		});
	});

	describe('Direct Operations on Specific Tiles by Coordinates', () => {
		const targetTileCoords = { x: 1, y: 1 };

		describe('Modifying a single character directly within a specified tile', () => {
			it('should update a character at local coordinates within a specified, existing tile', () => {
				const tile = layer.addTile(targetTileCoords.x, targetTileCoords.y);
				layer.setCharToTile(2, 3, 'X', targetTileCoords);
				expect(tile.getChar(2, 3)).toBe('X');
			});

			it('should create the specified tile if it does not exist to store a non-space character', () => {
				layer.setCharToTile(2, 3, 'Y', targetTileCoords);
				const newTile = tileMap.getTile(targetTileCoords.x, targetTileCoords.y);
				expect(newTile).not.toBeNull();
				expect(newTile?.getChar(2, 3)).toBe('Y');
			});

			it('should remove the specified tile if placing a space character makes it entirely empty', () => {
				const tile = layer.addTile(targetTileCoords.x, targetTileCoords.y);
				tile.setChar(0, 0, 'A');
				layer.setCharToTile(0, 0, ' ', targetTileCoords);
				expect(tileMap.getTile(targetTileCoords.x, targetTileCoords.y)).toBeNull();
			});

			it('should not create the specified tile if attempting to place a space character and the tile does not already exist', () => {
				layer.setCharToTile(2, 3, ' ', targetTileCoords);
				expect(tileMap.getTile(targetTileCoords.x, targetTileCoords.y)).toBeNull();
			});
		});

		describe('Placing a block of text directly onto a specified tile', () => {
			it('should fill a specified region of an existing tile with new character data', () => {
				const tile = layer.addTile(targetTileCoords.x, targetTileCoords.y);
				const regionString = 'AB\nC';
				layer.setRegionToTile(1, 1, regionString, targetTileCoords);
				expect(tile.getChar(1, 1)).toBe('A');
				expect(tile.getChar(2, 1)).toBe('B');
				expect(tile.getChar(1, 2)).toBe('C');
			});

			it('should create the specified tile if it does not exist to store new character data', () => {
				const regionString = 'DEF';
				layer.setRegionToTile(0, 0, regionString, targetTileCoords);
				const newTile = tileMap.getTile(targetTileCoords.x, targetTileCoords.y);
				expect(newTile).not.toBeNull();
				expect(newTile?.getChar(0, 0)).toBe('D');
				expect(newTile?.getChar(1, 0)).toBe('E');
				expect(newTile?.getChar(2, 0)).toBe('F');
			});

			it('should remove the specified tile if applying new character data (e.g., all spaces) makes it entirely empty', () => {
				const tile = layer.addTile(targetTileCoords.x, targetTileCoords.y);
				tile.setChar(5, 5, 'X');
				layerEmitSpy.mockClear();
				tile.setChar(5, 5, ' ');

				const emptyRegion = Array(TILE_SIZE).fill(' '.repeat(TILE_SIZE)).join('\n');
				layer.setRegionToTile(0, 0, emptyRegion, targetTileCoords, { skipSpaces: false });
				expect(tileMap.getTile(targetTileCoords.x, targetTileCoords.y)).toBeNull();
			});
		});

		describe('Filling a rectangular area directly within a specified tile with a character', () => {
			it('should populate a rectangular area of an existing tile with a repeating character', () => {
				const tile = layer.addTile(targetTileCoords.x, targetTileCoords.y);
				layer.fillRegionToTile(1, 1, 2, 2, 'F', targetTileCoords);
				expect(tile.getChar(1, 1)).toBe('F');
				expect(tile.getChar(2, 1)).toBe('F');
				expect(tile.getChar(1, 2)).toBe('F');
				expect(tile.getChar(2, 2)).toBe('F');
			});

			it('should create the specified tile if it does not exist to fill a rectangular area with a repeating character', () => {
				layer.fillRegionToTile(0, 0, 1, 1, 'G', targetTileCoords);
				const newTile = tileMap.getTile(targetTileCoords.x, targetTileCoords.y);
				expect(newTile).not.toBeNull();
				expect(newTile?.getChar(0, 0)).toBe('G');
			});

			it('should remove the specified tile if filling its area with space characters makes it entirely empty', () => {
				const tile = layer.addTile(targetTileCoords.x, targetTileCoords.y);
				tile.setChar(0, 0, 'X');
				layer.fillRegionToTile(0, 0, TILE_SIZE, TILE_SIZE, ' ', targetTileCoords);
				expect(tileMap.getTile(targetTileCoords.x, targetTileCoords.y)).toBeNull();
			});
		});
	});

	describe('Placing and Reading Blocks of Text at Global World Coordinates', () => {
		describe('Placing a block of text (setToRegion)', () => {
			it('should correctly place a block of text that fits entirely within a single tile area', () => {
				const text = 'Hello';
				layer.setToRegion(1, 1, text);
				const tile00 = tileMap.getTile(0, 0);
				expect(tile00).not.toBeNull();
				expect(tile00?.getChar(1, 1)).toBe('H');
				expect(tile00?.getChar(5, 1)).toBe('o');
			});

			it('should correctly distribute a block of text across multiple tiles horizontally', () => {
				const text = 'A'.repeat(TILE_SIZE + 5);
				layer.setToRegion(0, 0, text);
				const tile00 = tileMap.getTile(0, 0);
				const tile10 = tileMap.getTile(1, 0);
				expect(tile00).not.toBeNull();
				expect(tile10).not.toBeNull();
				expect(tile00?.data.substring(0, TILE_SIZE)).toBe(text.substring(0, TILE_SIZE));
				expect(tile10?.getChar(0, 0)).toBe(text[TILE_SIZE]);
			});

			it('should correctly distribute a block of text across multiple tiles vertically', () => {
				const linesArray = Array.from(
					{ length: TILE_SIZE + 1 },
					(_, i) => `L${String(i).padStart(2, '0')}`
				);
				const text = linesArray.join('\n');
				layer.setToRegion(0, 0, text);
				const tile00 = tileMap.getTile(0, 0);
				const tile01 = tileMap.getTile(0, 1);
				expect(tile00).not.toBeNull();
				expect(tile01).not.toBeNull();
				expect(tile00?.getChar(0, TILE_SIZE - 1)).toBe('L');
				expect(tile01?.getChar(0, 0)).toBe('L');
			});

			it('should correctly distribute a block of text across a grid of multiple tiles', () => {
				const char = 'M';
				const line = char.repeat(TILE_SIZE + 1);
				const text = Array(TILE_SIZE + 1)
					.fill(line)
					.join('\n');
				layer.setToRegion(0, 0, text);
				expect(tileMap.getTile(0, 0)?.getChar(TILE_SIZE - 1, TILE_SIZE - 1)).toBe(char);
				expect(tileMap.getTile(1, 0)?.getChar(0, TILE_SIZE - 1)).toBe(char);
				expect(tileMap.getTile(0, 1)?.getChar(TILE_SIZE - 1, 0)).toBe(char);
				expect(tileMap.getTile(1, 1)?.getChar(0, 0)).toBe(char);
			});

			it('should preserve existing content when new text contains spaces at those positions by default (skipSpaces=true)', () => {
				layer.setToRegion(0, 0, 'XXXX\nX XX\nXXXX', { skipSpaces: false });
				const textToPlace = 'A B\n C ';
				layer.setToRegion(0, 0, textToPlace);
				const tile00 = tileMap.getTile(0, 0);
				expect(tile00?.getChar(0, 0)).toBe('A');
				expect(tile00?.getChar(1, 0)).toBe('X');
				expect(tile00?.getChar(2, 0)).toBe('B');
				expect(tile00?.getChar(0, 1)).toBe('X');
				expect(tile00?.getChar(1, 1)).toBe('C');
				expect(tile00?.getChar(2, 1)).toBe('X');
			});

			it('should overwrite existing content with spaces from new text when explicitly configured (skipSpaces=false)', () => {
				layer.setToRegion(0, 0, 'XXXX\nXXXX', { skipSpaces: false });
				const text = 'A B\n C ';
				layer.setToRegion(0, 0, text, { skipSpaces: false });
				const tile00 = tileMap.getTile(0, 0);
				expect(tile00?.getChar(0, 0)).toBe('A');
				expect(tile00?.getChar(1, 0)).toBe(' ');
				expect(tile00?.getChar(2, 0)).toBe('B');
				expect(tile00?.getChar(0, 1)).toBe(' ');
				expect(tile00?.getChar(1, 1)).toBe('C');
				expect(tile00?.getChar(2, 1)).toBe(' ');
			});

			it('should remove underlying tiles if they become entirely empty after placing a block of text (e.g. all spaces with skipSpaces=false)', () => {
				layer.setToRegion(0, 0, 'ABC');
				layer.setToRegion(0, 0, '   ', { skipSpaces: false });
				expect(tileMap.getTile(0, 0)).toBeNull();
			});

			it('should not create new tiles for a block of text containing only spaces when skipping spaces by default', () => {
				layer.setToRegion(0, 0, '   \n  ');
				expect(tileMap.queryAll().length).toBe(0);
			});

			it('should not create new tiles containing only spaces for a block of text when not skipping spaces', () => {
				layer.setToRegion(0, 0, ' ', { skipSpaces: false });
				expect(tileMap.queryAll().length).toBe(0);
			});

			it('should remain unchanged when attempting to place an empty block of text', () => {
				layer.setToRegion(0, 0, '');
				expect(tileMap.queryAll().length).toBe(0);
			});
		});

		describe('Retrieving a block of text (readRegion)', () => {
			it('should retrieve a block of text residing entirely within a single tile', () => {
				layer.setToRegion(1, 1, 'AB\nCD');
				const result = layer.readRegion(1, 1, 2, 2);
				expect(result).toBe('AB\nCD');
			});

			it('should reconstruct a block of text from multiple tiles, using spaces for empty areas', () => {
				const textLine1 = 'A'.repeat(TILE_SIZE + 5);
				const textLine2 = 'B'.repeat(TILE_SIZE + 3);
				layer.setToRegion(0, 0, textLine1);
				layer.setToRegion(0, 1, textLine2);
				const readWidth = TILE_SIZE + 5;
				const result = layer.readRegion(0, 0, readWidth, 2);
				const expected = textLine1 + '\n' + textLine2.padEnd(readWidth, ' ');
				expect(result).toBe(expected);
			});

			it('should retrieve a block of text, padding with spaces for areas extending beyond existing content', () => {
				layer.setToRegion(0, 0, 'A');
				const result = layer.readRegion(0, 0, 3, 1);
				expect(result).toBe('A  ');
			});
		});

		describe('Erasing a rectangular area at global world coordinates (clearRegion)', () => {
			it('should fill the specified rectangular world area with space characters', () => {
				layer.setToRegion(0, 0, 'ABCD\nEFGH\nIJKL\nMNOP');
				layer.clearRegion(1, 1, 2, 2);
				const tile00 = tileMap.getTile(0, 0);
				expect(tile00).not.toBeNull();
				expect(tile00?.getChar(0, 0)).toBe('A');
				expect(tile00?.getChar(1, 1)).toBe(' ');
				expect(tile00?.getChar(2, 1)).toBe(' ');
				expect(tile00?.getChar(1, 2)).toBe(' ');
				expect(tile00?.getChar(2, 2)).toBe(' ');
				expect(tile00?.getChar(3, 3)).toBe('P');
			});

			it('should remove underlying tiles if they become entirely empty as a result of clearing the region', () => {
				layer.setToRegion(0, 0, 'A');
				layer.clearRegion(0, 0, 1, 1);
				expect(tileMap.getTile(0, 0)).toBeNull();
			});
		});

		describe('Filling a rectangular area at global world coordinates with a character (fillRegion)', () => {
			it('should populate the specified rectangular world area with a repeating character', () => {
				layer.fillRegion(1, 1, 2, 2, 'F');
				const tile00 = tileMap.getTile(0, 0);
				expect(tile00).not.toBeNull();
				expect(tile00?.getChar(1, 1)).toBe('F');
				expect(tile00?.getChar(2, 1)).toBe('F');
				expect(tile00?.getChar(1, 2)).toBe('F');
				expect(tile00?.getChar(2, 2)).toBe('F');
			});

			it('should create new tiles as necessary to accommodate filling a world area', () => {
				layer.fillRegion(TILE_SIZE, TILE_SIZE, 1, 1, 'G');
				const tile11 = tileMap.getTile(1, 1);
				expect(tile11).not.toBeNull();
				expect(tile11?.getChar(0, 0)).toBe('G');
			});
		});
	});

	describe('Modifying Layer-Level Attributes', () => {
		it('should allow its rendering and logical order to be changed', () => {
			layer.updateIndex(5);
			expect(layer.index).toBe(5);
		});

		describe('Applying multiple attribute changes simultaneously (update method)', () => {
			it('should allow its descriptive name to be changed', () => {
				const newName = 'New Layer Name';
				const { before, after } = layer.update({ name: newName });
				expect(layer.name).toBe(newName);
				expect(before.name).toBe(layerOptionsBase.name);
				expect(after.name).toBe(newName);
			});

			it('should allow its rendering and logical order to be changed through batch update', () => {
				const newIndex = 3;
				const { before, after } = layer.update({ index: newIndex });
				expect(layer.index).toBe(newIndex);
				expect(before.index).toBe(layerOptionsBase.index);
				expect(after.index).toBe(newIndex);
			});

			it('should allow its visibility and interactivity (locked status) to be changed', () => {
				const newOpts = { visible: false, locked: true };
				const { before, after } = layer.update({ opts: newOpts });
				expect(layer.getOpts()).toEqual(newOpts);
				expect(before.opts).toEqual(defaultLayerConfig);
				expect(after.opts).toEqual(newOpts);
			});

			it('should correctly apply partial updates to its visual/interaction settings while preserving unspecified ones', () => {
				const { after } = layer.update({ opts: { visible: false } });
				expect(layer.getOpts()).toEqual({ visible: false, locked: defaultLayerConfig.locked });
				expect(after.opts).toEqual({ visible: false, locked: defaultLayerConfig.locked });
			});

			it('should report the state before and after applying multiple attribute changes', () => {
				const updates: DeepPartial<ILayerModel> = {
					name: 'Updated Name',
					index: 10,
					opts: { visible: false }
				};
				const originalName = layer.name;
				const originalIndex = layer.index;
				const originalOpts = { ...layer.getOpts() };

				const { before, after } = layer.update(updates);

				expect(before.name).toBe(originalName);
				expect(before.index).toBe(originalIndex);
				expect(before.opts).toEqual(originalOpts);

				expect(after.name).toBe(updates.name);
				expect(after.index).toBe(updates.index);
				expect(after.opts?.visible).toBe(false);
				expect(after.opts?.locked).toBe(originalOpts.locked);
			});

			it('should keep attributes unchanged if they are not specified in an update request', () => {
				const originalName = layer.name;
				const { before, after } = layer.update({ index: 99 });
				expect(layer.name).toBe(originalName);
				expect(before.name).toBe(originalName);
				expect(after.name).toBe(originalName);
				expect(after.index).toBe(99);
			});
		});
	});

	describe('Layer Event Emission', () => {
		it('should emit "tile_change" when a character is set in a new or existing non-empty tile', () => {
			const charX = 5,
				charY = 5;
			layer.setChar(charX, charY, 'N');
			const tile = tileMap.getTile(0, 0);
			expect(layerEmitSpy).toHaveBeenCalledWith('tile_changed', {
				x: 0,
				y: 0,
				data: tile?.data,
				layerId: layer.id
			});

			layerEmitSpy.mockClear();
			layer.setChar(charX + 1, charY, 'M');
			expect(layerEmitSpy).toHaveBeenCalledWith('tile_changed', {
				x: 0,
				y: 0,
				data: tile?.data,
				layerId: layer.id
			});
		});

		it('should emit "tile_deleted" when setting a character makes a tile empty', () => {
			const charX = 1,
				charY = 1;
			layer.setChar(charX, charY, 'A');
			layerEmitSpy.mockClear();
			layer.setChar(charX, charY, ' ');
			expect(layerEmitSpy).toHaveBeenCalledWith('tile_deleted', {
				x: 0,
				y: 0,
				layerId: layer.id
			});
		});

		it('should emit "tile_change" when setCharToTile modifies an existing non-empty tile', () => {
			const tile = layer.addTile(1, 1);
			layerEmitSpy.mockClear();
			layer.setCharToTile(2, 2, 'X', { x: 1, y: 1 });
			expect(layerEmitSpy).toHaveBeenCalledWith('tile_changed', {
				x: 1,
				y: 1,
				data: tile.data,
				layerId: layer.id
			});
		});

		it('should emit "tile_deleted" when setCharToTile makes a tile empty', () => {
			layer.addTile(1, 1);
			layer.setCharToTile(0, 0, 'A', { x: 1, y: 1 });
			layerEmitSpy.mockClear();
			layer.setCharToTile(0, 0, ' ', { x: 1, y: 1 });
			expect(layerEmitSpy).toHaveBeenCalledWith('tile_deleted', {
				x: 1,
				y: 1,
				layerId: layer.id
			});
		});

		it('should emit "tile_change" when setRegionToTile modifies a tile and it remains non-empty', () => {
			const tile = layer.addTile(0, 0);
			layerEmitSpy.mockClear();
			layer.setRegionToTile(0, 0, 'Test', { x: 0, y: 0 });
			expect(layerEmitSpy).toHaveBeenCalledWith('tile_changed', {
				x: 0,
				y: 0,
				data: tile.data,
				layerId: layer.id
			});
		});

		it('should emit "tile_deleted" when setRegionToTile makes a tile empty', () => {
			layer.addTile(0, 0);
			layer.setChar(0, 0, 'A');
			layerEmitSpy.mockClear();
			const allSpaces = ' '.repeat(TILE_SIZE * TILE_SIZE);
			const lines = [];
			for (let i = 0; i < TILE_SIZE; i++) {
				lines.push(allSpaces.substring(i * TILE_SIZE, (i + 1) * TILE_SIZE));
			}
			layer.setRegionToTile(0, 0, lines.join('\n'), { x: 0, y: 0 }, { skipSpaces: false });
			expect(layerEmitSpy).toHaveBeenCalledWith('tile_deleted', {
				x: 0,
				y: 0,
				layerId: layer.id
			});
		});

		it('should emit "tile_change" for each affected tile when setToRegion modifies content and tiles remain non-empty', () => {
			layer.setToRegion(0, 0, 'A'.repeat(TILE_SIZE + 1));
			const tile00 = tileMap.getTile(0, 0);
			const tile10 = tileMap.getTile(1, 0);

			expect(layerEmitSpy).toHaveBeenCalledWith('tile_changed', {
				x: 0,
				y: 0,
				data: tile00?.data,
				layerId: layer.id
			});
			expect(layerEmitSpy).toHaveBeenCalledWith('tile_changed', {
				x: 1,
				y: 0,
				data: tile10?.data,
				layerId: layer.id
			});
		});

		it('should emit "tile_deleted" for tiles that become empty due to setToRegion', () => {
			layer.setToRegion(0, 0, 'A');
			layerEmitSpy.mockClear();
			layer.setToRegion(0, 0, ' ', { skipSpaces: false });
			expect(layerEmitSpy).toHaveBeenCalledWith('tile_deleted', {
				x: 0,
				y: 0,
				layerId: layer.id
			});
		});

		it('should emit "tile_change" when fillRegionToTile modifies a tile and it remains non-empty', () => {
			const tile = layer.addTile(0, 0);
			layerEmitSpy.mockClear();
			layer.fillRegionToTile(0, 0, 1, 1, 'F', { x: 0, y: 0 });
			expect(layerEmitSpy).toHaveBeenCalledWith('tile_changed', {
				x: 0,
				y: 0,
				data: tile.data,
				layerId: layer.id
			});
		});

		it('should emit "tile_deleted" when fillRegionToTile makes a tile empty', () => {
			layer.addTile(0, 0);
			layer.setChar(0, 0, 'A');
			layerEmitSpy.mockClear();
			layer.fillRegionToTile(0, 0, TILE_SIZE, TILE_SIZE, ' ', { x: 0, y: 0 });
			expect(layerEmitSpy).toHaveBeenCalledWith('tile_deleted', {
				x: 0,
				y: 0,
				layerId: layer.id
			});
		});
	});
});
