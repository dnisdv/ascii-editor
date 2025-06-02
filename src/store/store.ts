import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { svelteStoreEnhancer } from './sveltestore';

import layersReducer from './slices/layers/layers.slice';
import toolsReducer from './slices/tools/tool.slice';
import documentReducer from './slices/document/document.slice';

const rootReducer = combineReducers({
	layers: layersReducer,
	tools: toolsReducer,
	document: documentReducer
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof createStore>;

export const createStore = () =>
	configureStore({
		reducer: rootReducer,
		devTools: process.env.NODE_ENV !== 'production',
		enhancers: (getDefaultEnhancers) => getDefaultEnhancers().concat(svelteStoreEnhancer)
	});
