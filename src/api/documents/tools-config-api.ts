import { DocumentController } from './document';

interface ApiDependencies {
	documentController: DocumentController;
	save: () => void;
}

export const ToolsApi = ({ documentController, save }: ApiDependencies) => ({
	async listTools(): Promise<string[]> {
		return Object.keys(documentController.getSchema().tools.data || {});
	},

	registerToolConfig(toolName: string, config: Record<string, unknown>): void {
		const toolsData = documentController.getSchema().tools.data;
		if (toolsData[toolName]) return;
		toolsData[toolName] = config;
		save();
	},

	removeToolConfig(toolName: string): void {
		const toolsData = documentController.getSchema().tools.data;
		if (!toolsData[toolName]) {
			throw new Error(`Tool '${toolName}' does not exist.`);
		}
		delete toolsData[toolName];
		if (documentController.getSchema().tools.activeTool === toolName) {
			documentController.getSchema().tools.activeTool = null;
		}
		save();
	},

	activateTool(toolName: string): void {
		documentController.getSchema().tools.activeTool = toolName;
		save();
	},

	deactivateTool(): void {
		if (!documentController.getSchema().tools.activeTool) return;
		documentController.getSchema().tools.activeTool = null;
		save();
	},

	deactivateAllTools(): void {
		documentController.getSchema().tools.activeTool = null;
		save();
	},

	updateToolConfig(toolName: string, newConfig: Record<string, unknown>): void {
		const toolsData = documentController.getSchema().tools.data;
		if (!toolsData[toolName]) {
			toolsData[toolName] = {};
		}

		toolsData[toolName] = {
			...toolsData[toolName],
			...newConfig
		};
		save();
	}
});
