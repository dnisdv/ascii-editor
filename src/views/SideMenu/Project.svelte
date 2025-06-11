<script lang="ts">
	import EditableText from '@components/editable-text/EditableText.svelte';
	import { useDispatch } from '@store/useDispatch';
	import { useSelector } from '@store/useSelector';
	import { selectDocument, updateDocument } from '@store/slices/document';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import PromoMyself from './PromoMyself.svelte';

	const dispatch = useDispatch();
	const document = useSelector(selectDocument);

	const onTitleChange = ({ value }: { value: string }) => {
		if (!$document) return;
		dispatch(updateDocument({ title: value }));
	};
	$: projectTitle = $document?.name || 'Untitled Project';
</script>

<div class="px-3 pr-1.5 pt-3">
	<div class="project mb-2.5 flex flex-row items-center justify-between pr-2">
		<ThemeIcon name="logo" />
		<PromoMyself class="absolute right-1.5 top-1.5" />
	</div>

	<div class="-ml-1.5 items-center justify-start gap-1 rounded-sm text-sm font-medium">
		<EditableText
			trigger="click"
			class="px-1.5 py-0.5"
			inputClass="bg-secondary"
			blockClass="hover:bg-secondary inline-block rounded-sm"
			onChange={onTitleChange}
			value={projectTitle}
		/>
	</div>
</div>
