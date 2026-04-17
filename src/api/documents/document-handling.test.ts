import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentController } from './document';
import { LayersApi } from './layers-api';
import type { LayerSerializableSchemaType } from '@editor/types';
import type { LayerGroupSerializableSchemaType } from '@editor/serializer/group.serializer.schema';

describe('Document Handling (LayersApi)', () => {
	let documentController: DocumentController;
	let saveMock: ReturnType<typeof vi.fn>;
	let layersApi: ReturnType<typeof LayersApi>;

	beforeEach(() => {
		documentController = new DocumentController();
		saveMock = vi.fn();
		layersApi = LayersApi({ documentController, save: saveMock });
	});

	it('should add a layer', async () => {
		const layer: LayerSerializableSchemaType = {
			id: 'layer-1',
			name: 'Layer 1',
			index: 0,
			opts: { visible: true, locked: false },
			objects: {},
			objectOrder: [],
			orderKeys: {}
		};

		layersApi.addLayer(layer);
		await Promise.resolve();

		expect(documentController.getSchema().layers.data['layer-1']).toEqual(layer);
		expect(saveMock).toHaveBeenCalled();
	});

	it('should update a layer', async () => {
		const layer: LayerSerializableSchemaType = {
			id: 'layer-1',
			name: 'Layer 1',
			index: 0,
			opts: { visible: true, locked: false },
			objects: {},
			objectOrder: [],
			orderKeys: {}
		};
		layersApi.addLayer(layer);
		saveMock.mockClear();

		layersApi.updateLayer({ id: 'layer-1', name: 'Updated Layer' });
		await Promise.resolve(); 

		expect(documentController.getSchema().layers.data['layer-1'].name).toBe('Updated Layer');
		expect(saveMock).toHaveBeenCalled();
	});

	it('should remove a layer', async () => {
		const layer: LayerSerializableSchemaType = {
			id: 'layer-1',
			name: 'Layer 1',
			index: 0,
			opts: { visible: true, locked: false },
			objects: {},
			objectOrder: [],
			orderKeys: {}
		};
		layersApi.addLayer(layer);
		saveMock.mockClear();

		layersApi.removeLayer('layer-1');
		await Promise.resolve();

		expect(documentController.getSchema().layers.data['layer-1']).toBeUndefined();
		expect(saveMock).toHaveBeenCalled();
	});

	it('should duplicate a layer', async () => {
		const layer: LayerSerializableSchemaType = {
			id: 'layer-1',
			name: 'Layer 1',
			index: 0,
			opts: { visible: true, locked: false },
			objects: {},
			objectOrder: [],
			orderKeys: {}
		};
		layersApi.addLayer(layer);
		saveMock.mockClear();

		layersApi.duplicateLayer('layer-1');
		await Promise.resolve();

		const layers = documentController.getSchema().layers.data;
		const layerIds = Object.keys(layers);
		expect(layerIds.length).toBe(2);
		const newLayerId = layerIds.find((id) => id !== 'layer-1');
		expect(newLayerId).toBeDefined();
		expect(layers[newLayerId!].name).toBe('Layer 1 (Copy)');
		expect(saveMock).toHaveBeenCalled();
	});

	it('should add a smart object', async () => {
		const layer: LayerSerializableSchemaType = {
			id: 'layer-1',
			name: 'Layer 1',
			index: 0,
			opts: { visible: true, locked: false },
			objects: {},
			objectOrder: [],
			orderKeys: {}
		};
		layersApi.addLayer(layer);
		saveMock.mockClear();

		const objectData = {
			id: 'obj-1',
			type: 'rectangle',
			data: { x: 10, y: 20, width: 100, height: 100 }
		};
		layersApi.addSmartObject('layer-1', 'obj-1', 'rectangle', 0, objectData);
		await Promise.resolve();

		const storedLayer = documentController.getSchema().layers.data['layer-1'];
		expect(storedLayer.objects['obj-1']).toBeDefined();
		expect(storedLayer.objects['obj-1'].type).toBe('rectangle');
		expect(storedLayer.objects['obj-1'].data).toEqual(objectData.data);
		expect(saveMock).toHaveBeenCalled();
	});

	it('should update a smart object', async () => {
		const layer: LayerSerializableSchemaType = {
			id: 'layer-1',
			name: 'Layer 1',
			index: 0,
			opts: { visible: true, locked: false },
			objects: {},
			objectOrder: [],
			orderKeys: {}
		};
		layersApi.addLayer(layer);
		const objectData = {
			id: 'obj-1',
			type: 'rectangle',
			data: { x: 10, y: 20, width: 100, height: 100 }
		};
		layersApi.addSmartObject('layer-1', 'obj-1', 'rectangle', 0, objectData);
		saveMock.mockClear();

		layersApi.updateSmartObject('layer-1', 'obj-1', 'rectangle', {
			op: 'replace',
			path: 'data.x',
			value: 50
		});
		await Promise.resolve();

		const storedLayer = documentController.getSchema().layers.data['layer-1'];
		expect(storedLayer.objects['obj-1'].data.x).toBe(50);
		expect(saveMock).toHaveBeenCalled();
	});

	it('should remove a smart object', async () => {
		const layer: LayerSerializableSchemaType = {
			id: 'layer-1',
			name: 'Layer 1',
			index: 0,
			opts: { visible: true, locked: false },
			objects: {},
			objectOrder: [],
			orderKeys: {}
		};
		layersApi.addLayer(layer);
		const objectData = {
			id: 'obj-1',
			type: 'rectangle',
			data: { x: 10, y: 20, width: 100, height: 100 }
		};
		layersApi.addSmartObject('layer-1', 'obj-1', 'rectangle', 0, objectData);
		saveMock.mockClear();

		layersApi.removeSmartObject('layer-1', 'obj-1');
		await Promise.resolve();

		const storedLayer = documentController.getSchema().layers.data['layer-1'];
		expect(storedLayer.objects['obj-1']).toBeUndefined();
		expect(saveMock).toHaveBeenCalled();
	});

	it('should update smart object data (simulating TextGridObject)', async () => {
		const layer: LayerSerializableSchemaType = {
			id: 'layer-1',
			name: 'Layer 1',
			index: 0,
			opts: { visible: true, locked: false },
			objects: {},
			objectOrder: [],
			orderKeys: {}
		};
		layersApi.addLayer(layer);

		const objectData = {
			id: 'grid-1',
			type: 'text-grid',
			data: {}
		};
		layersApi.addSmartObject('layer-1', 'grid-1', 'text-grid', 0, objectData);
		saveMock.mockClear();

		const tileData = { x: 0, y: 0, data: 'A' };
		layersApi.updateSmartObject('layer-1', 'grid-1', 'text-grid', {
			op: 'replace',
			path: 'data.0,0',
			value: tileData
		});
		await Promise.resolve();

		const storedLayer = documentController.getSchema().layers.data['layer-1'];
		expect(storedLayer.objects['grid-1'].data['0,0']).toEqual(tileData);
		expect(saveMock).toHaveBeenCalled();
	});
});

describe('Document Handling – Group Methods', () => {
	let documentController: DocumentController;
	let saveMock: ReturnType<typeof vi.fn>;
	let layersApi: ReturnType<typeof LayersApi>;

	const makeGroup = (id: string, overrides?: Partial<LayerGroupSerializableSchemaType>): LayerGroupSerializableSchemaType => ({
		id,
		name: `Group ${id}`,
		collapsed: false,
		parentId: null,
		index: 0,
		opts: { visible: true, locked: false },
		...overrides
	});

	beforeEach(() => {
		documentController = new DocumentController();
		saveMock = vi.fn();
		layersApi = LayersApi({ documentController, save: saveMock });
	});

	it('should add a group', async () => {
		const group = makeGroup('g1');
		layersApi.addGroup(group);
		await Promise.resolve();

		expect(documentController.getGroup('g1')).toEqual(group);
		expect(saveMock).toHaveBeenCalled();
	});

	it('should remove a group', async () => {
		layersApi.addGroup(makeGroup('g1'));
		saveMock.mockClear();

		layersApi.removeGroup('g1');
		await Promise.resolve();

		expect(documentController.getGroup('g1')).toBeUndefined();
		expect(saveMock).toHaveBeenCalled();
	});

	it('should update a group name', async () => {
		layersApi.addGroup(makeGroup('g1'));
		saveMock.mockClear();

		layersApi.updateGroup('g1', { name: 'Renamed' });
		await Promise.resolve();

		expect(documentController.getGroup('g1')!.name).toBe('Renamed');
		expect(saveMock).toHaveBeenCalled();
	});

	it('should update group opts partially', async () => {
		layersApi.addGroup(makeGroup('g1'));
		saveMock.mockClear();

		layersApi.updateGroup('g1', { opts: { visible: false, locked: false } });
		await Promise.resolve();

		const group = documentController.getGroup('g1')!;
		expect(group.opts.visible).toBe(false);
		expect(group.opts.locked).toBe(false);
	});

	it('should persist multiple groups independently', async () => {
		layersApi.addGroup(makeGroup('g1', { index: 0 }));
		layersApi.addGroup(makeGroup('g2', { index: 1 }));
		await Promise.resolve();

		expect(documentController.getGroup('g1')).toBeDefined();
		expect(documentController.getGroup('g2')).toBeDefined();
	});

	it('should store groups in schema.layers.groups', () => {
		layersApi.addGroup(makeGroup('g1'));
		const schema = documentController.getSchema();
		expect(schema.layers.groups?.['g1']).toBeDefined();
	});

	it('remove is a no-op for unknown group', () => {
		expect(() => layersApi.removeGroup('nonexistent')).not.toThrow();
	});

	it('update is a no-op for unknown group', () => {
		expect(() => layersApi.updateGroup('nonexistent', { name: 'x' })).not.toThrow();
	});
});
