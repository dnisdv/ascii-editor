import { BaseBusLayers } from '@editor/bus-layers';
import type { ILayerModel, MetaData } from '@editor/types';
import {
	addLayerAndActivate,
	removeLayer,
	removeTile,
	setActiveLayer,
	silentSetActiveLayer,
	silentSetLayers,
	silentUpdateLayers,
	updateLayer,
	updateTile
} from '@store/slices/layers';
import { type AppStore } from '@store/store';
import { getDispatch } from '@store/useDispatch';

export class EditorLayersBus extends BaseBusLayers {
	private store;

	constructor(store: AppStore) {
		super();
		this.store = store;

		this.on('layers::create::response', this.handleLayersCreation.bind(this));
		this.on('layer::change_active::response', this.handleActiveLayerChange.bind(this));
		this.on('layer::create::response', this.handleLayerCreation.bind(this));
		this.on('layer::remove::response', this.handleLayerRemoving.bind(this));
		this.on('layer::update::response', this.handleLayerUpdate.bind(this));
		this.on('layer::tile::change', this.handleTileChange.bind(this));
		this.on('layer::tile::removed', this.handleTileRemove.bind(this));
		this.on('layers::update::response', this.handleLayersUpdate.bind(this));
	}

	handleTileRemove({ x, y, layerId }: { x: number; y: number; layerId: string }) {
		const dispatch = getDispatch(this.store);
		dispatch(removeTile({ x, y, layerId }));
	}

	handleLayersUpdate(layers: Pick<ILayerModel, 'id'>[]) {
		const dispatch = getDispatch(this.store);
		dispatch(silentUpdateLayers({ data: layers }));
	}

	handleLayerUpdate({ id, ...rest }: { id: string; name?: string; index?: number }) {
		const dispatch = getDispatch(this.store);
		dispatch(updateLayer({ id, ...rest }));
	}

	handleLayerRemoving({ id }: { id: string }) {
		const dispatch = getDispatch(this.store);
		dispatch(removeLayer({ id }));
	}

	handleActiveLayerChange({ id }: { id: string | null }, meta?: MetaData) {
		const dispatch = getDispatch(this.store);
		if (meta?.reason === 'hydratation') {
			return dispatch(silentSetActiveLayer({ id }));
		}

		dispatch(setActiveLayer({ id }));
	}

	handleLayerCreation(layer: ILayerModel) {
		const dispatch = getDispatch(this.store);
		dispatch(addLayerAndActivate(layer));
	}

	handleLayersCreation(layers: ILayerModel[], meta?: MetaData) {
		const dispatch = getDispatch(this.store);

		if (meta?.reason === 'hydratation') {
			const mappedLayers = layers.reduce<Record<string, ILayerModel>>((acc, layer) => {
				acc[layer.id] = layer;
				return acc;
			}, {});
			return dispatch(
				silentSetLayers({
					data: mappedLayers
				})
			);
		}
	}

	handleTileChange(_data: { x: number; y: number; data: string; layerId: string }) {
		if (!_data) return;
		const { x, y, data, layerId } = _data;
		const dispatch = getDispatch(this.store);
		dispatch(updateTile({ x, y, data, layerId }));
	}
}
