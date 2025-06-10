import type { ToolManager } from '@editor/tool-manager';
import {
	ToolsConfigSerializableSchema,
	type ToolsConfigSerializableSchemaType
} from '@editor/types';

export class ToolsConfigSerializer {
	constructor(private toolManager: ToolManager) {}

	serialize(): ToolsConfigSerializableSchemaType {
		const activeTool = this.toolManager.isActive(this.toolManager['activeTool'] || '')
			? this.toolManager['activeTool']
			: null;

		const data: ToolsConfigSerializableSchemaType['data'] = {};

		this.toolManager.getTools().forEach((tool) => {
			data[tool.name] = tool.config;
		});

		return {
			activeTool: activeTool || '',
			data
		};
	}

	deserialize(data: ToolsConfigSerializableSchemaType): void {
		const validatedData = ToolsConfigSerializableSchema.parse(data);
		this.toolManager.deactivateAllTools();
		for (const [toolName, config] of Object.entries(validatedData.data)) {
			const tool = this.toolManager.getTools().find((p) => p.name === toolName);

			if (tool) {
				tool.config = config;
				tool.saveConfig(config);

				if (tool) {
					tool.onConfigRestored();
				}
			}
		}

		if (validatedData.activeTool) {
			this.toolManager.activateTool(validatedData.activeTool);
		}
	}
}
