import type { CoreApi } from '@editor/core';
import type { ToolsManagerEvents } from '@editor/types';
import { DocumentsApi } from '@/api';
import { Syncable } from './sync';

export class ToolSyncManager extends Syncable {
	constructor(
		private coreApi: CoreApi,
		private documentApi: ReturnType<typeof DocumentsApi.withDocument>
	) {
		super();
	}

	public start(): void {
		this.subscribeToLayerEvents();
	}
	public stop(): void {
		this.unsubscribeToLayerEvents();
	}

	private subscribeToLayerEvents(): void {
		const toolsManager = this.coreApi.getToolManager();
		toolsManager.on('tool::activated', this.onToolActivated.bind(this));
		toolsManager.on('tool::config::changed', this.onToolConfigChanged.bind(this));
	}

	private unsubscribeToLayerEvents(): void {
		const toolsManager = this.coreApi.getToolManager();
		toolsManager.off('tool::activated', this.onToolActivated.bind(this));
		toolsManager.off('tool::config::changed', this.onToolConfigChanged.bind(this));
		toolsManager.off('tool::registered', this.onToolRegistered.bind(this));
	}

	private onToolActivated(event: ToolsManagerEvents['tool::activated']) {
		this.documentApi.activateTool(event.name);
	}

	private onToolConfigChanged(event: ToolsManagerEvents['tool::config::changed']) {
		this.documentApi.updateToolConfig(event.name, event.config);
	}

	private onToolRegistered(event: ToolsManagerEvents['tool::registered']) {
		this.documentApi.registerToolConfig(event.name, event.config);
	}
}
