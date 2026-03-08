import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface UIState {
	visible: boolean;
	gridVisible: boolean;
}

const initialState: UIState = {
	visible: true,
	gridVisible: true
};

export const uiSlice = createSlice({
	name: 'ui',
	initialState,
	reducers: {
		toggleUI: (state) => {
			state.visible = !state.visible;
		},
		setUIVisible: (state, action: PayloadAction<boolean>) => {
			state.visible = action.payload;
		},
		toggleGrid: (state) => {
			state.gridVisible = !state.gridVisible;
		},
		setGridVisible: (state, action: PayloadAction<boolean>) => {
			state.gridVisible = action.payload;
		}
	}
});

export const { toggleUI, setUIVisible, toggleGrid, setGridVisible } = uiSlice.actions;
export default uiSlice.reducer;
