<script lang="ts">
	import type { GroupDescriptor } from './types';
	import PropertyField from './PropertyField.svelte';

	export let group: GroupDescriptor;
	export let onChange: (path: string, value: unknown) => void;

	$: compact = group.fields.length > 1 &&
		group.fields.every((f) => f.spec.type === 'number' || f.spec.type === 'enum' || f.spec.type === 'string');
</script>

<div class="flex flex-col">
	<div class="flex items-center px-3 pt-3 pb-1.5">
		<span class="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{group.label}</span>
	</div>

	<div class={compact ? 'grid grid-cols-2 gap-1 px-3 pb-3' : 'flex flex-col gap-1 px-3 pb-3'}>
		{#each group.fields as field (field.path)}
			<PropertyField {field} {compact} {onChange} />
		{/each}
	</div>
</div>
