// WARNING: Hardcoded until multiple documents/document selection
//
import type { DocumentMetaData } from '@editor/serializer';
import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '@store/store';
import { getDocument, updateDocument } from './document.actions';

export interface DocumentState {
	name: DocumentMetaData['title'];
	id: DocumentMetaData['id'];
	version: DocumentMetaData['version'];
}

const initialState: DocumentState = {
	version: '0',
	name: '',
	id: '__PROJECT__'
};

const documentSlice = createSlice({
	name: 'documents',
	initialState,
	reducers: {},
	extraReducers: (builder) => {
		builder.addCase(getDocument.fulfilled, (state, action) => {
			state.id = action.payload.id;
			state.name = action.payload.title;
			state.version = action.payload.version;
		});
		builder.addCase(updateDocument.fulfilled, (state, action) => {
			state.name = action.payload.title;
		});
	}
});

export const selectDocument = (state: RootState) => state.document;
export default documentSlice.reducer;
