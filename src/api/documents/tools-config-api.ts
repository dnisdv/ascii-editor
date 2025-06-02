import type { DocumentSchemaType } from '@editor/serializer';
import { DBLocalStorage } from './db-localstorage';
import { DocumentsApi } from './document-api';
import { DocumentController } from './document';

export const ToolsApi = (documentId: string) => ({
	async listTools(): Promise<string[]> {
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		const documentController = new DocumentController(documentSchema);
		return Object.keys(documentController.getSchema().tools.data || {});
	},

	registerToolConfig(toolName: string, config: Record<string, unknown>): void {
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		const documentController = new DocumentController(documentSchema);
		const toolsData = documentController.getSchema().tools.data;
		if (toolsData[toolName]) return;
		toolsData[toolName] = config;
		new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`).save(
			documentController.getSchema()
		);
	},

	removeToolConfig(toolName: string): void {
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		const documentController = new DocumentController(documentSchema);
		const toolsData = documentController.getSchema().tools.data;
		if (!toolsData[toolName]) {
			throw new Error(`Tool '${toolName}' does not exist.`);
		}
		delete toolsData[toolName];
		if (documentController.getSchema().tools.activeTool === toolName) {
			documentController.getSchema().tools.activeTool = null;
		}
		new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`).save(
			documentController.getSchema()
		);
	},

	activateTool(toolName: string): void {
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		const documentController = new DocumentController(documentSchema);
		if (!documentController.getSchema().tools.data[toolName]) {
			throw new Error(`Tool '${toolName}' does not exist.`);
		}
		documentController.getSchema().tools.activeTool = toolName;
		new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`).save(
			documentController.getSchema()
		);
	},

	deactivateTool(): void {
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		const documentController = new DocumentController(documentSchema);
		if (!documentController.getSchema().tools.activeTool) return;
		documentController.getSchema().tools.activeTool = null;
		new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`).save(
			documentController.getSchema()
		);
	},

	deactivateAllTools(): void {
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		const documentController = new DocumentController(documentSchema);
		documentController.getSchema().tools.activeTool = null;
		new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`).save(
			documentController.getSchema()
		);
	},

	updateToolConfig(toolName: string, newConfig: Record<string, unknown>): void {
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		const documentController = new DocumentController(documentSchema);
		const toolsData = documentController.getSchema().tools.data;
		if (!toolsData[toolName]) {
			throw new Error(`Tool '${toolName}' does not exist.`);
		}
		toolsData[toolName] = {
			...toolsData[toolName],
			...newConfig
		};
		new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`).save(
			documentController.getSchema()
		);
	}
});
