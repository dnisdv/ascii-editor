import { createDocumentScopedThunk } from '@store/helpers';
import type { IToolModel } from '@editor/types/external/tool';
import { DocumentsApi } from '@/api';

export const registerTool = createDocumentScopedThunk<IToolModel, IToolModel>(
	'tools/registerTool',
	({ documentId, ...tool }) => {
		DocumentsApi.withDocument(documentId).registerToolConfig(tool.name, tool.config || {});
		return tool;
	}
);

export const activateTool = createDocumentScopedThunk<
	Pick<IToolModel, 'name'>,
	Pick<IToolModel, 'name'>
>('tools/activateTool', ({ documentId, name }) => {
	DocumentsApi.withDocument(documentId).activateTool(name);
	return { name };
});

export const updateToolConfig = createDocumentScopedThunk<
	Pick<IToolModel, 'name' | 'config'>,
	Pick<IToolModel, 'name' | 'config'>
>('tools/updateToolConfig', ({ documentId, name, config }) => {
	DocumentsApi.withDocument(documentId).updateToolConfig(name, config || {});
	return { name, config };
});

export const deactivateTool = createDocumentScopedThunk<void, void>(
	'tools/deactivateTool',
	({ documentId }) => {
		DocumentsApi.withDocument(documentId).deactivateTool();
	}
);

export const deactivateAllTools = createDocumentScopedThunk<void, void>(
	'tools/deactivateAllTool',
	({ documentId }) => {
		DocumentsApi.withDocument(documentId).deactivateAllTools();
	}
);
