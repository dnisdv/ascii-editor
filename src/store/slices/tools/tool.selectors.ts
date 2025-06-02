import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@store/store';

export const selectActiveTool = (state: RootState) => state.tools.activeTool;
export const selectToolData = (state: RootState) => state.tools.data;
export const selectActiveProject = createSelector(
	[selectActiveTool, selectToolData],
	(activeToolId, projectsData) => projectsData[String(activeToolId)] || null
);

export const isToolActive = (tool: string) =>
	createSelector([selectActiveTool], (activeToolId) => activeToolId === tool);
