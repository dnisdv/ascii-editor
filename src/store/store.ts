import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { svelteStoreEnhancer } from './sveltestore';

import documentReducer from './slices/document/document.slice';
import uiReducer from './slices/ui/ui.slice';

const rootReducer = combineReducers({
	document: documentReducer,
	ui: uiReducer
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof createStore>;

export const createStore = () =>
	configureStore({
		reducer: rootReducer,
		devTools: process.env.NODE_ENV !== 'production',
		enhancers: (getDefaultEnhancers) => getDefaultEnhancers().concat(svelteStoreEnhancer)
	});
