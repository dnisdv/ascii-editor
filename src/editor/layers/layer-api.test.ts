import { beforeEach, describe, it, expect } from 'vitest';
import { LayersManager } from './layers-manager';
import { Config } from '@editor/config';
import { HistoryManager } from '@editor/history-manager';
import { LayerSerializer } from '@editor/serializer';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { MockSmartObject } from '@editor/__mock__/smart-object';

describe('LayerController composition (real + temp layers)', () => {
	let lm: LayersManager;
	let config: Config;

	beforeEach(() => {
		const historyManager = new HistoryManager();
		config = new Config();
		const smartObjectsManager = new SmartObjectsManager(config);
		const layerSerializer = new LayerSerializer(smartObjectsManager, config);
		lm = new LayersManager({ config, historyManager, layerSerializer });
	});

	it('getObjects returns composed order (real + single temp), temp overlays respected', () => {
		const [id, real] = lm.addLayer();

		const A = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
		const B = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'B');
		const C = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'C');
		real.addObject(A, { orderKey: 'a0c' });
		real.addObject(B, { orderKey: 'a0m' });
		real.addObject(C, { orderKey: 'a0z' });

		expect(real.getObjects().map((o) => o.id)).toEqual(['default-text-grid', 'A', 'B', 'C']);
		const [, temp] = lm.addTempLayer(id);

		const T = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'T');
		temp.addOrReplaceObject(T, { orderKey: 'a0a' });

		const api = lm.getLayer(id)!;
		expect(api.getObjects().map((o) => o.id)).toEqual(['default-text-grid', 'T', 'A', 'B', 'C']);
	});

	it('moveObject by index repositions object from temp layer within composed order', () => {
		const [id, real] = lm.addLayer();

		const A = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
		const B = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'B');
		const C = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'C');

		real.addObject(A, { orderKey: 'a0a' });
		real.addObject(B, { orderKey: 'a0m' });
		real.addObject(C, { orderKey: 'a0z' });

		const [, tempApi] = lm.addTempLayer(id);

		expect(real.getObjects().map((o) => o.id)).toEqual(['default-text-grid', 'A', 'B', 'C']);

		const T = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'T');
		tempApi.addOrReplaceObject(T, { orderKey: 'a0y' });

		const layer = lm.getLayer(id)!;
		expect(layer.getObjects().map((o) => o.id)).toEqual(['default-text-grid', 'A', 'B', 'T', 'C']);

		layer.moveObject('T', 0);
		expect(layer.getObjects().map((o) => o.id)).toEqual(['T', 'default-text-grid', 'A', 'B', 'C']);
	});

	it('supports multiple temp layers; latest overlay wins per id and ordering stays deterministic', () => {
		const [id, real] = lm.addLayer();

		const A = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
		const B = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'B');
		real.addObject(A, { orderKey: 'a0a' });
		real.addObject(B, { orderKey: 'a0m' });

		const [, t1] = lm.addTempLayer(id);
		const [, t2] = lm.addTempLayer(id);

		const Aoverlay1 = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
		const Aoverlay2 = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');

		const T1 = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'TMP1');
		const T2 = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'TMP2');

		t1.addOrReplaceObject(T1, { orderKey: 'a0b' });
		t1.addOrReplaceObject(Aoverlay1, { orderKey: 'a0z' });

		t2.addOrReplaceObject(Aoverlay2, { orderKey: 'a0c' });
		t2.addOrReplaceObject(T2, { orderKey: 'a0y' });

		const api = lm.getLayer(id)!;
		expect(api.getOrderKey('A')).toBe('a0c');
		expect(api.getObjects().map((o) => o.id)).toEqual([
			'default-text-grid',
			'TMP1',
			'A',
			'B',
			'TMP2'
		]);
	});

	it('getObjectById/getIndexOfObject/getOrderKey search composition top-down', () => {
		const [realId, real] = lm.addLayer();
		const [, tempApi] = lm.addTempLayer(realId);

		const A = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
		real.addObject(A, { orderKey: 'a0a' });
		const Aoverlay = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
		tempApi.addOrReplaceObject(Aoverlay, { orderKey: 'a0z' });

		const api = lm.getLayer(realId)!;
		const obj = api.getObjectById('A');

		expect(obj).toBeTruthy();
		expect(obj!.id).toBe('A');
		expect(api.getOrderKey('A')).toBe('a0z');
		expect(api.getIndexOfObject('A')).toBe(1);
	});

	it('moveObject affects composed order by regenerating fractional key', () => {
		const [, real] = lm.addLayer();

		const A = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
		const B = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'B');
		const C = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'C');

		real.addObject(A, { orderKey: 'a0a' });
		real.addObject(B, { orderKey: 'a0m' });
		real.addObject(C, { orderKey: 'a0z' });

		expect(real.getObjects().map((o) => o.id)).toEqual(['default-text-grid', 'A', 'B', 'C']);

		const tempId = real.createTempLayer();
		const T = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'T');

		real.insertObjectInTempAtEnd(tempId, T);
		expect(real.getObjects().map((o) => o.id)).toEqual(['default-text-grid', 'A', 'B', 'T', 'C']);

		real.moveObject('B', 0);
		expect(real.getObjects().map((o) => o.id)).toEqual(['B', 'default-text-grid', 'A', 'T', 'C']);

		real.disposeTempLayer(tempId);
	});

	it('addObject without position places newest at top; insert helpers respect composition', () => {
		const [id] = lm.addLayer();
		const api = lm.getLayer(id)!;

		const A = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
		const B = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'B');

		api.addObject(A);
		api.addObject(B);

		expect(api.getObjects().map((o) => o.id)).toEqual(['B', 'A', 'default-text-grid']);

		const tempId = api.createTempLayer();
		const T = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'T');

		api.insertObjectInTempAtTop(tempId, T);
		expect(api.getObjects().map((o) => o.id)).toEqual(['T', 'B', 'A', 'default-text-grid']);

		api.disposeTempLayer(tempId);
	});

	it('insertObjectInTempUsingSourceKeyOrTop mirrors the real object orderKey when present', () => {
		const [id, real] = lm.addLayer();
		const api = lm.getLayer(id)!;
		const A = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
		real.addObject(A, { orderKey: 'a0m' });

		const tempId = api.createTempLayer();
		const Aoverlay = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
		api.insertObjectInTempUsingSourceKeyOrTop(tempId, Aoverlay);

		expect(api.getOrderKey('A')).toBe('a0m');
		api.disposeTempLayer(tempId);
	});

	it('moveObject repositions within composed ids deterministically', () => {
		const [id, real] = lm.addLayer();
		const api = lm.getLayer(id)!;
		const A = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
		const B = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'B');
		const C = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'C');
		real.addObject(A, { orderKey: 'a0a' });
		real.addObject(B, { orderKey: 'a0m' });
		real.addObject(C, { orderKey: 'a0z' });
		expect(api.getObjects().map((o) => o.id)).toEqual(['default-text-grid', 'A', 'B', 'C']);
		api.moveObject('C', 0);
		expect(api.getObjects().map((o) => o.id)).toEqual(['C', 'default-text-grid', 'A', 'B']);
	});

	it('moveObject: place real object between temp and real neighbor', () => {
		const [id] = lm.addLayer();
		const api = lm.getLayer(id)!;
		const A = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
		const B = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'B');
		api.addObject(A);
		api.addObject(B);

		const tempId = api.createTempLayer();
		const C = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'C');
		api.insertObjectInTempAtTop(tempId, C);

		expect(api.getObjects().map((o) => o.id)).toEqual(['C', 'B', 'A', 'default-text-grid']);

		api.moveObject('A', 1);

		const order = api.getObjects().map((o) => o.id);
		expect(order).toEqual(['C', 'A', 'B', 'default-text-grid']);

		const keyA = api.getOrderKey('A');
		expect(typeof keyA).toBe('string');

		api.disposeTempLayer(tempId);
	});

	it('moveObject on multiple temp overlays: three real + three temp move correctly', () => {
		const [id, real] = lm.addLayer();
		const api = lm.getLayer(id)!;

		const A = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
		const B = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'B');
		const C = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'C');
		real.addObject(A, { orderKey: 'a0a' });
		real.addObject(B, { orderKey: 'a0m' });
		real.addObject(C, { orderKey: 'a0z' });

		const tempId = api.createTempLayer();
		const T1 = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'T1');
		const T2 = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'T2');
		const T3 = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'T3');

		api.insertObjectInTempAtTop(tempId, T1);
		api.insertObjectInTempAtEnd(tempId, T2);
		api.insertObjectInTempBetween(tempId, 'A', 'B', T3);

		const ids0 = api
			.getObjects()
			.map((o) => o.id)
			.filter((id) => id !== 'default-text-grid');
		expect(ids0).toEqual(['T1', 'A', 'T3', 'B', 'T2', 'C']);

		api.moveObject('T2', 0);
		const ids1 = api.getObjects().map((o) => o.id);
		const ids1Filtered = ids1.filter((id) => id !== 'default-text-grid');
		expect(ids1Filtered).toEqual(['T2', 'T1', 'A', 'T3', 'B', 'C']);
		expect(typeof api.getOrderKey('T2')).toBe('string');

		const afterBIndex = ids1.indexOf('B') + 1;
		api.moveObject('T3', afterBIndex);
		const ids2 = api
			.getObjects()
			.map((o) => o.id)
			.filter((id) => id !== 'default-text-grid');

		expect(ids2.indexOf('T3')).toBeGreaterThan(ids2.indexOf('B'));
		expect(typeof api.getOrderKey('T3')).toBe('string');

		const composed2 = api.getObjects().map((o) => o.id);
		const afterCIndex = composed2.indexOf('C') + 1;
		api.moveObject('T1', afterCIndex);
		const ids3 = api
			.getObjects()
			.map((o) => o.id)
			.filter((id) => id !== 'default-text-grid');
		expect(ids3.indexOf('T1')).toBeGreaterThan(ids3.indexOf('C'));
		expect(typeof api.getOrderKey('T1')).toBe('string');

		api.disposeTempLayer(tempId);
	});
});
