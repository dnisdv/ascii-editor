import { LayersApi } from './layers-api';
import { ToolsApi } from './tools-config-api';
import { DBLocalStorage } from './db-localstorage';
import type { DocumentMetaData, DocumentSchemaType } from '@editor/types';

export const DocumentsApi = {
	async getDocumentsMetaData(): Promise<DocumentMetaData[]> {
		return [];
	},

	withDocument(id: string) {
		return DocumentApi(id);
	}
};

const DocumentApi = (id: string) => ({
	updateDocument(updates: Pick<DocumentMetaData, 'title'>): DocumentMetaData {
		const db = new DBLocalStorage<DocumentSchemaType>(`document_${id}`);
		const document = db.load();
		if (!document) {
			throw new Error(`Document with id ${id} not found`);
		}
		document.meta = { ...document.meta, ...updates };
		db.save(document);
		return document.meta;
	},

	getDocument(): DocumentSchemaType {
		const db = new DBLocalStorage<DocumentSchemaType>(`document_${id}`);
		const document = db.load();
		return document!;
	},

	getDocumentMetadata(): DocumentMetaData {
		const db = new DBLocalStorage<DocumentSchemaType>(`document_${id}`);
		const document = db.load();
		if (!document) {
			throw new Error(`Document with id ${id} not found`);
		}

		return document.meta;
	},

	...LayersApi(id),
	...ToolsApi(id)
});
