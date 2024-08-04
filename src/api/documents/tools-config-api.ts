import type { DocumentSchemaType } from "@editor/serializer";
import { DBLocalStorage } from "./db-localstorage";
import { DocumentsApi } from "./document-api";

export const ToolsApi = (documentId: string) => ({
	async listTools(): Promise<string[]> {
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		return Object.keys(documentSchema.tools.data || {});
	},
	registerToolConfig(toolName: string, config: Record<string, unknown>): void {
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		if (documentSchema.tools.data[toolName]) return;
		documentSchema.tools.data[toolName] = config;
		new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`).save(documentSchema);
	},
	removeToolConfig(toolName: string): void {
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		if (!documentSchema.tools.data[toolName]) {
			throw new Error(`Tool '${toolName}' does not exist.`);
		}
		delete documentSchema.tools.data[toolName];
		if (documentSchema.tools.activeTool === toolName) {
			documentSchema.tools.activeTool = null;
		}
		new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`).save(documentSchema);
	},
	activateTool(toolName: string): void {
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		if (!documentSchema.tools.data[toolName]) {
			throw new Error(`Tool '${toolName}' does not exist.`);
		}
		documentSchema.tools.activeTool = toolName;
		new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`).save(documentSchema);
	},
	deactivateTool(): void {
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		if (!documentSchema.tools.activeTool) return;
		documentSchema.tools.activeTool = null;
		new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`).save(documentSchema);
	},
	deactivateAllTools(): void {
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		documentSchema.tools.activeTool = null;
		new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`).save(documentSchema);
	},
	updateToolConfig(toolName: string, newConfig: Record<string, unknown>): void {
		const documentSchema = DocumentsApi.withDocument(documentId).getDocument();
		if (!documentSchema.tools.data[toolName]) {
			throw new Error(`Tool '${toolName}' does not exist.`);
		}
		documentSchema.tools.data[toolName] = {
			...documentSchema.tools.data[toolName],
			...newConfig,
		};
		new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`).save(documentSchema);
	},
});


