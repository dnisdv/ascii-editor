import type { DocumentsApi } from '@/api';
import type { CoreApi } from '@editor/core';
import { Syncable } from './sync';

export class DocumentSyncManager extends Syncable {
	constructor(
		private coreApi: CoreApi,
		private documentApi: ReturnType<typeof DocumentsApi.withDocument>
	) {
		super();
	}

	start() {}

	stop() {}
}
