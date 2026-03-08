import type { SmartObjectSerializableSchemaType } from '@editor/serializer/smart-object.schema';
import { compressString, decompressString } from '@editor/utils/compression';
import { getSerializedObjectSize } from '../session/session-utils';
import type { LayerController } from '@editor/layers/layer-api';
import type { SmartObjectsManager } from '@editor/smart-objects-manager';

export interface GridRegionSnapshot {
	layerId: string;
	cellX: number;
	cellY: number;
	width: number;
	height: number;
	content: string;
	compressed?: boolean;
	codec?: 'brotli' | 'deflate';
}

export function readGridRegion(
	sourceLayer: LayerController,
	cellX: number,
	cellY: number,
	width: number,
	height: number
): string {
	return sourceLayer.grid.readRegion(cellX, cellY, width, height) || '';
}

export function snapshotGridRegion(
	sourceLayer: LayerController,
	layerId: string,
	cellX: number,
	cellY: number,
	width: number,
	height: number
): GridRegionSnapshot {
	const plain = readGridRegion(sourceLayer, cellX, cellY, width, height);
	const { data, codec } = compressString(plain, { codec: 'deflate', level: 6 });
	return {
		layerId,
		cellX,
		cellY,
		width,
		height,
		content: data,
		compressed: true,
		codec
	};
}

export interface RegionSpec {
	cellX: number;
	cellY: number;
	width: number;
	height: number;
}

export function captureGridSnapshots(
	sourceLayer: LayerController,
	regions: RegionSpec[]
): GridRegionSnapshot[] {
	return regions.map((r) =>
		snapshotGridRegion(sourceLayer, sourceLayer.id, r.cellX, r.cellY, r.width, r.height)
	);
}

export function clearGridRegion(
	sourceLayer: LayerController,
	cellX: number,
	cellY: number,
	width: number,
	height: number
): void {
	return sourceLayer.grid.setToRegion(cellX, cellY, ' '.repeat(width * height), {
		skipSpaces: false
	});
}

export function restoreGridRegionContent(
	sourceLayer: LayerController,
	cellX: number,
	cellY: number,
	content: string,
	compressed?: boolean,
	codec?: 'brotli' | 'deflate'
): void {
	if (!content) return;
	const text = compressed ? decompressString(content, codec) : content;
	sourceLayer.grid.setToRegion(cellX, cellY, text, { skipSpaces: false });
}

export function restoreGridSnapshots(
	snapshots: GridRegionSnapshot[],
	layersManager: { getLayer: (id: string) => LayerController | null }
): void {
	snapshots.forEach((snapshot) => {
		const layer = layersManager.getLayer(snapshot.layerId);
		if (layer) {
			restoreGridRegionContent(
				layer,
				snapshot.cellX,
				snapshot.cellY,
				snapshot.content,
				snapshot.compressed,
				snapshot.codec
			);
		}
	});
}

export const clearObjects = (
	sourceLayer: LayerController,
	objects: SmartObjectSerializableSchemaType[]
): void => {
	const textObjects = objects.filter((obj) => obj.type === 'text-selection');

	textObjects.forEach((obj) => {
		const { cellX, cellY, width, height } = getSerializedObjectSize(obj);
		sourceLayer.grid.clearRegion(cellX, cellY, width, height);
	});
};

export const restoreTextGridObjects = (
	sourceLayer: LayerController,
	objects: SmartObjectSerializableSchemaType[]
): void => {
	const textObjects = objects.filter((obj) => obj.type === 'text-selection');
	textObjects.forEach((obj) => {
		const { cellX, cellY } = getSerializedObjectSize(obj);

		const data = obj.data || {};
		const raw: string | undefined = data.selectedText;
		const comp: string | undefined = data.selectedTextCompressed;
		const codec: 'brotli' | 'deflate' | undefined = data.codec;
		const text = comp ? decompressString(comp, codec) : (raw ?? '');
		sourceLayer.grid.setToRegion(cellX, cellY, text, { skipSpaces: true });
	});
};

export const restoreSmartObjects = (
	sourceLayer: LayerController,
	objects: SmartObjectSerializableSchemaType[],
	smartObjectManager: SmartObjectsManager,
	orderKeys?: Record<string, string>
): void => {
	const exceptTextObjects = objects.filter((obj) => obj.type !== 'text-selection');
	if (exceptTextObjects.length === 0) return;

	for (const obj of exceptTextObjects) {
		const copy = JSON.parse(JSON.stringify(obj));
		delete copy.index;

		const object = smartObjectManager.createObject(copy.type, copy);
		if (!object) continue;

		const key = orderKeys?.[obj.id];
		const position = key ? { orderKey: key } : undefined;
		sourceLayer.addOrReplaceObject(object, position);
	}
};
export const removeObjectsById = (sourceLayer: LayerController, objectIds: string[]): void => {
	objectIds.forEach((id) => {
		sourceLayer.removeObject(id);
	});
};
