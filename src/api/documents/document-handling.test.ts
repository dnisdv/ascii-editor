import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentController } from './document';
import { LayersApi } from './layers-api';
import type { LayerSerializableSchemaType } from '@editor/types';

describe('Document Handling (LayersApi)', () => {
	let documentController: DocumentController;
	let saveMock: ReturnType<typeof vi.fn>;
	let layersApi: ReturnType<typeof LayersApi>;

	beforeEach(() => {
		documentController = new DocumentController();
		saveMock = vi.fn();
		layersApi = LayersApi({ documentController, save: saveMock });
	});

	it('should add a layer', () => {
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

		expect(documentController.getSchema().layers.data['layer-1']).toEqual(layer);
		expect(saveMock).toHaveBeenCalled();
	});

	it('should update a layer', () => {
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

		expect(documentController.getSchema().layers.data['layer-1'].name).toBe('Updated Layer');
		expect(saveMock).toHaveBeenCalled();
	});

	it('should remove a layer', () => {
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

		expect(documentController.getSchema().layers.data['layer-1']).toBeUndefined();
		expect(saveMock).toHaveBeenCalled();
	});

	it('should duplicate a layer', () => {
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

		const layers = documentController.getSchema().layers.data;
		const layerIds = Object.keys(layers);
		expect(layerIds.length).toBe(2);
		const newLayerId = layerIds.find((id) => id !== 'layer-1');
		expect(newLayerId).toBeDefined();
		expect(layers[newLayerId!].name).toBe('Layer 1 (Copy)');
		expect(saveMock).toHaveBeenCalled();
	});

	it('should add a smart object', () => {
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

		const storedLayer = documentController.getSchema().layers.data['layer-1'];
		expect(storedLayer.objects['obj-1']).toBeDefined();
		expect(storedLayer.objects['obj-1'].type).toBe('rectangle');
		expect(storedLayer.objects['obj-1'].data).toEqual(objectData.data);
		expect(saveMock).toHaveBeenCalled();
	});

	it('should update a smart object', () => {
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

		const storedLayer = documentController.getSchema().layers.data['layer-1'];
		expect(storedLayer.objects['obj-1'].data.x).toBe(50);
		expect(saveMock).toHaveBeenCalled();
	});

	it('should remove a smart object', () => {
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

		const storedLayer = documentController.getSchema().layers.data['layer-1'];
		expect(storedLayer.objects['obj-1']).toBeUndefined();
		expect(saveMock).toHaveBeenCalled();
	});

	it('should update smart object data (simulating TextGridObject)', () => {
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

		const storedLayer = documentController.getSchema().layers.data['layer-1'];
		expect(storedLayer.objects['grid-1'].data['0,0']).toEqual(tileData);
		expect(saveMock).toHaveBeenCalled();
	});
});
