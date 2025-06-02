import { createSlice } from '@reduxjs/toolkit';
import {
	activateTool,
	deactivateTool,
	registerTool,
	deactivateAllTools,
	updateToolConfig
} from './tool.actions';
import type { IToolModel } from '@editor/types/external/tool';

export interface ToolsState {
	loading: boolean;
	error: string | null;
	data: Record<string, IToolModel>;
	activeTool: string | null;
}

const initialState: ToolsState = {
	loading: false,
	error: null,
	data: {},
	activeTool: null
};

const toolsSlice = createSlice({
	name: 'tools',
	initialState,
	reducers: {},

	extraReducers: (builder) => {
		// -------------------------------------------------------------------

		builder
			.addCase(registerTool.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(registerTool.fulfilled, (state, action) => {
				const { name, ...rest } = action.payload;

				if (!state.data[name]) {
					state.data[name] = { name, ...rest };
				}
			})
			.addCase(registerTool.rejected, (state, action) => {
				state.loading = false;
				state.error = action.error.message || 'Failed to set active layers';
			})

			// -------------------------------------------------------------------

			.addCase(activateTool.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(activateTool.fulfilled, (state, action) => {
				const { name: toolName } = action.payload;
				if (state.data[toolName]) {
					state.activeTool = toolName;
				}
			})
			.addCase(activateTool.rejected, (state, action) => {
				state.loading = false;
				state.error = action.error.message || 'Failed to set active layers';
			})

			// -------------------------------------------------------------------

			.addCase(deactivateTool.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(deactivateTool.fulfilled, (state) => {
				if (state.activeTool && state.data[state.activeTool]) {
					// state.data[state.activeTool].isActive = false;
					state.activeTool = null;
				}
			})
			.addCase(deactivateTool.rejected, (state, action) => {
				state.loading = false;
				state.error = action.error.message || 'Failed to set active layers';
			})

			// -------------------------------------------------------------------

			.addCase(deactivateAllTools.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(deactivateAllTools.fulfilled, (state) => {
				if (state.activeTool && state.data[state.activeTool]) {
					// state.data[state.activeTool].isActive = false;
					state.activeTool = null;
				}
			})
			.addCase(deactivateAllTools.rejected, (state, action) => {
				state.loading = false;
				state.error = action.error.message || 'Failed to set active layers';
			})

			// -------------------------------------------------------------------

			.addCase(updateToolConfig.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(updateToolConfig.fulfilled, (state, { payload }) => {
				const { name, config } = payload;
				state.data[name].config = {
					...state.data[name].config,
					...config
				};
			})
			.addCase(updateToolConfig.rejected, (state, action) => {
				state.loading = false;
				state.error = action.error.message || 'Failed to set active layers';
			});
	}
});

export default toolsSlice.reducer;
