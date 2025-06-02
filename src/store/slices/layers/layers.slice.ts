import { createSlice } from '@reduxjs/toolkit';
import {
	addLayer,
	addLayerAndActivate,
	removeLayer,
	setActiveLayer,
	setLayers,
	silentSetActiveLayer,
	silentSetLayer,
	silentSetLayers,
	silentUpdateLayers,
	updateLayer
} from './layers.actions';
import type { ILayerModel } from '@editor/types';

export interface LayersState {
	data: Record<string, ILayerModel>;
	activeLayer: string | undefined | null;
	loading: boolean;
	error: string | null;
}

const initialState: LayersState = {
	data: {},
	activeLayer: '',
	loading: false,
	error: null
};

const layersSlice = createSlice({
	name: 'layers',
	initialState,
	reducers: {},
	extraReducers: (builder) => {
		builder

			// -------------------------------------------------------------------

			.addCase(addLayerAndActivate.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(addLayerAndActivate.fulfilled, (state, action) => {
				const data = action.payload;

				state.data = {
					...state.data,
					[data.id]: data
				};

				state.activeLayer = data.id;
			})
			.addCase(addLayerAndActivate.rejected, (state, action) => {
				state.loading = false;
				state.error = action.error.message || 'Failed to set active layers';
			})

			// -------------------------------------------------------------------

			.addCase(addLayer.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(addLayer.fulfilled, (state, action) => {
				const data = action.payload;

				state.data = {
					...state.data,
					[data.id]: data
				};
			})
			.addCase(addLayer.rejected, (state, action) => {
				state.loading = false;
				state.error = action.error.message || 'Failed to set active layers';
			})
			// -------------------------------------------------------------------
			.addCase(setLayers.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(setLayers.fulfilled, (state, action) => {
				const data = action.payload;

				state.data = {
					...state.data,
					...data
				};
			})
			.addCase(setLayers.rejected, (state, action) => {
				state.loading = false;
				state.error = action.error.message || 'Failed to set active layers';
			})
			// -------------------------------------------------------------------
			.addCase(updateLayer.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(updateLayer.fulfilled, (state, action) => {
				const data = action.payload;

				state.data[String(data.id)] = {
					...state.data[data.id],
					...data
				};
			})
			.addCase(updateLayer.rejected, (state, action) => {
				state.loading = false;
				state.error = action.error.message || 'Failed to set active layers';
			})

			// -------------------------------------------------------------------

			.addCase(removeLayer.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(removeLayer.fulfilled, (state, action) => {
				const id = action.payload;
				delete state.data[id];
			})
			.addCase(removeLayer.rejected, (state, action) => {
				state.loading = false;
				state.error = action.error.message || 'Failed to set active layers';
			})

			// -------------------------------------------------------------------

			.addCase(setActiveLayer.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(setActiveLayer.fulfilled, (state, action) => {
				const id = action.payload;
				state.activeLayer = id;
			})
			.addCase(setActiveLayer.rejected, (state, action) => {
				state.loading = false;
				state.error = action.error.message || 'Failed to set active layers';
			})

			// -------------------------------------------------------------------

			.addCase(silentSetLayer.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(silentSetLayer.fulfilled, (state, action) => {
				const data = action.payload;
				state.data = {
					...state.data,
					[data.id]: data
				};
			})
			.addCase(silentSetLayer.rejected, (state, action) => {
				state.loading = false;
				state.error = action.error.message || 'Failed to set active layers';
			})

			// -------------------------------------------------------------------

			.addCase(silentSetLayers.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(silentSetLayers.fulfilled, (state, action) => {
				const data = action.payload;

				state.data = {
					...state.data,
					...data
				};
			})
			.addCase(silentSetLayers.rejected, (state, action) => {
				state.loading = false;
				state.error = action.error.message || 'Failed to set active layers';
			})

			// -------------------------------------------------------------------

			.addCase(silentSetActiveLayer.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(silentSetActiveLayer.fulfilled, (state, action) => {
				const id = action.payload;
				state.activeLayer = id;
			})
			.addCase(silentSetActiveLayer.rejected, (state, action) => {
				state.loading = false;
				state.error = action.error.message || 'Failed to set active layers';
			})

			// -------------------------------------------------------------------

			.addCase(silentUpdateLayers.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(silentUpdateLayers.fulfilled, (state, action) => {
				const data = action.payload;

				data.forEach((layer) => {
					state.data[layer.id] = {
						...state.data[layer.id],
						...layer
					};
				});
			})
			.addCase(silentUpdateLayers.rejected, (state, action) => {
				state.loading = false;
				state.error = action.error.message || 'Failed to set active layers';
			});
	}
});

export default layersSlice.reducer;
