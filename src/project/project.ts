import { DocumentsApi } from '@/api';
import type { CoreApi } from '@editor/core';
import type { DocumentSchemaType } from '@editor/types';
import { SyncManager } from './sync-manager';

export class Project {
	private syncManager: SyncManager | null = null;
	private documentId: string;
	private coreApi: CoreApi;

	constructor(documentId: string, coreApi: CoreApi) {
		this.documentId = documentId;
		this.coreApi = coreApi;
		this.syncManager = new SyncManager(this.coreApi, this.documentId);
	}

	public documentSchema(): DocumentSchemaType {
		return DocumentsApi.withDocument(this.documentId).getDocument();
	}

	public startSyncing(): void {
		this.syncManager?.startSyncing();
	}

	public stopSyncing(): void {
		this.syncManager?.stopSyncing();
	}
}
