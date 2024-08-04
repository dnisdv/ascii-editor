<script lang="ts">
	import EditableText from '@components/editable-text/EditableText.svelte';
	import { useDispatch } from '@store/useDispatch';
	import { useSelector } from '@store/useSelector';
	import { selectDocument, updateDocument } from '@store/slices/document';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';

	const dispatch = useDispatch();
	const document = useSelector(selectDocument);

	const onTitleChange = ({ detail: { value } }: CustomEvent<{ value: string }>) => {
		if (!$document) return;
		dispatch(updateDocument({ title: value }));
	};
	$: projectTitle = $document?.name || 'Untitled Project';
</script>

<div class="px-3 pt-3">
	<div class="project mb-2.5 flex flex-row items-center justify-between pr-2">
		<ThemeIcon name="logo" />
	</div>

	<div class="flex items-center justify-start gap-1 text-sm font-medium">
		<EditableText on:change={onTitleChange} bind:value={projectTitle} />
	</div>
</div>
