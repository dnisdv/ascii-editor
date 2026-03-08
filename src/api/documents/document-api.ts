import { LayersApi } from './layers-api';
import { ToolsApi } from './tools-config-api';
import { DBLocalStorage } from './db-localstorage';
import { DocumentController } from './document'; // Import the controller
import type { DocumentMetaData, DocumentSchemaType } from '@editor/types';

export const DocumentsApi = {
	async getDocumentsMetaData(): Promise<DocumentMetaData[]> {
		return [];
	},

	withDocument(id: string) {
		return DocumentApi(id);
	}
};

const DocumentApi = (id: string) => {
	const db = new DBLocalStorage<DocumentSchemaType>(`document_${id}`);
	const documentSchema = db.load();

	const documentController = new DocumentController(documentSchema || undefined);

	const save = () => db.save(documentController.getSchema());

	const dependencies = { documentController, save };

	return {
		updateDocument(updates: Pick<DocumentMetaData, 'title'>): DocumentMetaData {
			const document = documentController.getSchema();
			if (!document) {
				throw new Error(`Document with id ${id} not found`);
			}
			document.meta = { ...document.meta, ...updates };
			save();
			return document.meta;
		},

		getDocument(): DocumentSchemaType {
			return documentController.getSchema();
		},

		getDocumentMetadata(): DocumentMetaData {
			const document = documentController.getSchema();
			if (!document) {
				throw new Error(`Document with id ${id} not found`);
			}
			return document.meta;
		},

		...LayersApi(dependencies),
		...ToolsApi(dependencies)
	};
};
