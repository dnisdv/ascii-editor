import { DocumentsApi } from '@/api';
import type { DocumentMetaData } from '@editor/serializer';
import { createAsyncThunk } from '@reduxjs/toolkit';
import { createDocumentScopedThunk } from '@store/helpers';

export const getDocument = createAsyncThunk('documents/getDocument', async (id: string) => {
	return DocumentsApi.withDocument(id).getDocumentMetadata();
});

export const updateDocument = createDocumentScopedThunk<
	Pick<DocumentMetaData, 'title'>,
	Pick<DocumentMetaData, 'title'>
>('documents/updateDocument', ({ title, documentId }) => {
	return DocumentsApi.withDocument(documentId).updateDocument({ title });
});
