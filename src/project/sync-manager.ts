import type { CoreApi } from '@editor/core';
import { DocumentsApi } from '@/api';
import { LayerSyncManager } from './layers-sync';
import { ToolSyncManager } from './tools-sync';
import { DocumentSyncManager } from './project-sync';

export class SyncManager {
	layerSyncManager: LayerSyncManager;
	toolsSyncManager: ToolSyncManager;
	documentSyncManager: DocumentSyncManager;

	constructor(coreApi: CoreApi, documentId: string) {
		const documentApi = DocumentsApi.withDocument(documentId);

		this.layerSyncManager = new LayerSyncManager(coreApi, documentApi);
		this.toolsSyncManager = new ToolSyncManager(coreApi, documentApi);
		this.documentSyncManager = new DocumentSyncManager(coreApi, documentApi);
	}

	startSyncing(): void {
		this.layerSyncManager.start();
		this.toolsSyncManager.start();
		this.documentSyncManager.start();
	}

	stopSyncing(): void {
		this.layerSyncManager.stop();
		this.toolsSyncManager.stop();
		this.documentSyncManager.stop();
	}
}
