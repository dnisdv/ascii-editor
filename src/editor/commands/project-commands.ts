import type { CoreApi } from '@editor/core';
import type { CommandRegistry } from '@editor/commands/command-registry';
import { EditorCommand } from '@editor/commands/ids';
import { compressProject, decompressProject, downloadBlob, pickFile } from '@/api/file-io';
import { DBLocalStorage } from '@/api/documents/db-localstorage';
import type { DocumentSchemaType } from '@editor/serializer';
import { Project } from '@/project/project';

interface ProjectCommandsDeps {
	core: CoreApi;
	documentId: string;
	getCurrentProject: () => Project | null;
	setCurrentProject: (project: Project) => void;
	onImport?: () => void;
}

export function registerProjectCommands(
	registry: CommandRegistry,
	{ core, documentId, getCurrentProject, setCurrentProject, onImport }: ProjectCommandsDeps
): void {
	registry.register(EditorCommand.ProjectExport, async () => {
		const data = core.getSerializer().serialize();
		const project = getCurrentProject();
		if (project) {
			data.meta.title = project.documentSchema().meta.title;
		}
		try {
			const blob = await compressProject(data);
			downloadBlob(blob, `${data.meta.title || 'project'}.dnascii`);
			core.getFeedbackManager().report({
				code: 'project.export.success',
				message: 'Project exported',
				type: 'success'
			});
		} catch {
			core.getFeedbackManager().report({
				code: 'project.export.error',
				message: 'Failed to export project',
				type: 'error'
			});
		}
	});

	registry.register(EditorCommand.ProjectImport, async () => {
		const file = await pickFile('.dnascii');
		if (!file) return;
		try {
			const data = await decompressProject(file);

			getCurrentProject()?.stopSyncing();

			// Save full imported document to localStorage first
			const db = new DBLocalStorage<DocumentSchemaType>(`document_${documentId}`);
			data.meta.id = documentId;
			db.save(data);

			core.getSerializer().deserialize(data);
			core.getHistoryManager().clear();
			core.getSelectionManager().commitSelection();

			const newProject = new Project(documentId, core);
			setCurrentProject(newProject);
			newProject.startSyncing();

			core.render();

			onImport?.();

			core.getFeedbackManager().report({
				code: 'project.import.success',
				message: 'Project imported',
				type: 'success'
			});
		} catch {
			core.getFeedbackManager().report({
				code: 'project.import.error',
				message: 'Failed to import project',
				type: 'error'
			});
		}
	});
}
