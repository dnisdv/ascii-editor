<script lang="ts">
	import { usePropertiesPanel } from './usePropertiesPanel';
	import PropertyGroup from './PropertyGroup.svelte';

	const { descriptor, setProperty } = usePropertiesPanel();
</script>

{#if !$descriptor.isEmpty}
	<div class="fixed top-4 right-4 mt-[52px] z-50 flex flex-col w-60 max-h-[calc(100vh-84px)] overflow-y-auto rounded-xl border border-border bg-background" aria-label="Properties">

		<div class="flex items-baseline gap-1.5 px-3 pt-2.5 pb-2 border-b border-border">
			<span class="text-[11px] font-semibold text-foreground capitalize">Properties</span>
		</div>

		{#each $descriptor.commonGroups as group, i (group.key)}
			{#if i > 0}<div class="h-px bg-border mx-3" ></div>{/if}
			<PropertyGroup {group} onChange={setProperty} />
		{/each}

		{#each $descriptor.objectDescriptors as obj (obj.objectId)}
			<div class="h-px bg-border mx-3" ></div>
			<div class="flex items-center gap-1.5 px-3 pt-2 pb-1">
				<span class="text-[9px] font-semibold uppercase tracking-[0.05em] px-[5px] py-px rounded bg-muted text-muted-foreground whitespace-nowrap">{obj.objectType}</span>
				<span class="text-[11px] text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{obj.objectName}</span>
			</div>
			{#each obj.uniqueGroups as group (group.key)}
				<PropertyGroup
					{group}
					onChange={(path, value) => setProperty(path, value, [obj.objectId])}
				/>
			{/each}
		{/each}

	</div>
{/if}
