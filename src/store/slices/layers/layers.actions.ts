import type { RequireAtLeastOne } from '@lib/utils.type';
import type { ILayerModel } from '@editor/types';
import { DocumentsApi } from '@/api/documents/document-api';
import { createDocumentScopedThunk } from '@store/helpers';

export const addLayer = createDocumentScopedThunk<ILayerModel, ILayerModel>(
	'layers/addLayer',
	({ documentId, ...layer }) => {
		DocumentsApi.withDocument(documentId).addLayer(layer);
		return layer;
	}
);

export const addLayerAndActivate = createDocumentScopedThunk<ILayerModel, ILayerModel>(
	'layers/addLayerAndActivate',
	({ name, id, documentId, index, opts }) => {
		DocumentsApi.withDocument(documentId).addLayer({ name, id, index, opts });
		return { name, id, index, opts };
	}
);

export const setLayers = createDocumentScopedThunk<
	Record<string, ILayerModel>,
	{ data: Record<string, ILayerModel> }
>('layers/setLayers', ({ data }) => {
	return data;
});

export const silentUpdateLayers = createDocumentScopedThunk<
	RequireAtLeastOne<ILayerModel, 'id'>[],
	{ data: RequireAtLeastOne<ILayerModel, 'id'>[] }
>('layers/silentUpdateLayers', ({ data }) => {
	return data;
});

export const updateLayer = createDocumentScopedThunk<
	RequireAtLeastOne<ILayerModel, 'id'>,
	RequireAtLeastOne<ILayerModel, 'id'>
>('layers/updateLayer', ({ documentId, ...rest }) => {
	DocumentsApi.withDocument(documentId).updateLayer(rest);
	return rest;
});

export const removeLayer = createDocumentScopedThunk<string, { id: string }>(
	'layers/removeLayer',
	({ id, documentId }) => {
		DocumentsApi.withDocument(documentId).removeLayer(id);
		return id;
	}
);

export const setActiveLayer = createDocumentScopedThunk<string | null, { id: string | null }>(
	'layers/setActiveLayer',
	({ id, documentId }) => {
		DocumentsApi.withDocument(documentId).setActiveLayer(id);
		return id;
	}
);

export const updateTile = createDocumentScopedThunk<
	void,
	{ x: number; y: number; data: string; layerId: string }
>('layers/setTileData', ({ x, y, data, layerId, documentId }) => {
	DocumentsApi.withDocument(documentId).updateTile(layerId, x, y, data);
});

export const removeTile = createDocumentScopedThunk<
	void,
	{ x: number; y: number; layerId: string }
>('layers/setTileData', ({ x, y, layerId, documentId }) => {
	DocumentsApi.withDocument(documentId).removeTile(layerId, x, y);
});

export const silentSetLayer = createDocumentScopedThunk<ILayerModel, ILayerModel>(
	'layers/silentSetLayer',
	(layer) => {
		return layer;
	}
);

export const silentSetLayers = createDocumentScopedThunk<
	Record<string, ILayerModel>,
	{ data: Record<string, ILayerModel> }
>('layers/silentSetLayers', ({ data }) => {
	return data;
});

export const silentSetActiveLayer = createDocumentScopedThunk<string | null, { id: string | null }>(
	'layers/silentSetActiveLayer',
	({ id }) => {
		return id;
	}
);
