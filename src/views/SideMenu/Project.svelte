<script lang="ts">
	import EditableText from '@components/editable-text/EditableText.svelte';
	import { useDispatch } from '@store/useDispatch';
	import { useSelector } from '@store/useSelector';
	import { selectDocument, updateDocument } from '@store/slices/document';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import PromoMyself from './PromoMyself.svelte';
	import * as DropdownMenu from '@components/dropdown-menu';
	import { useCommands } from '@/config/useCommands';
	import { EditorCommand } from '@editor/commands/ids';

	const dispatch = useDispatch();
	const document = useSelector(selectDocument);
	const commands = useCommands();

	const onTitleChange = ({ value }: { value: string }) => {
		if (!$document) return;
		dispatch(updateDocument({ title: value }));
	};
	$: projectTitle = $document?.name || 'Untitled Project';

	function handleExport() {
		commands.execute(EditorCommand.ProjectExport);
	}

	function handleImport() {
		commands.execute(EditorCommand.ProjectImport);
	}
</script>

<div class="px-3 pr-1.5 pt-3">
	<div class="project mb-2.5 flex flex-row items-center justify-between pr-2">
		<ThemeIcon name="logo" />
		<PromoMyself class="absolute right-1.5 top-1.5" />
	</div>

	<div class="-ml-1.5 flex items-center justify-between gap-1 rounded-sm text-sm font-medium">
		<EditableText
			trigger="click"
			class="px-1.5 py-0.5"
			inputClass="bg-secondary"
			blockClass="hover:bg-secondary inline-block rounded-sm"
			onChange={onTitleChange}
			value={projectTitle}
		/>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger class="outline-none rounded-sm p-1 hover:bg-secondary">
				<ThemeIcon name="3dots-horizontal" size={14} />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="start" side="bottom" class="min-w-[140px]">
				<DropdownMenu.Item on:click={handleExport} class="gap-3">
					Save local copy
					<DropdownMenu.Shortcut>.dnascii</DropdownMenu.Shortcut>
				</DropdownMenu.Item>
				<DropdownMenu.Item on:click={handleImport} class="gap-3">
					Import
					<DropdownMenu.Shortcut>.dnascii</DropdownMenu.Shortcut>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</div>
