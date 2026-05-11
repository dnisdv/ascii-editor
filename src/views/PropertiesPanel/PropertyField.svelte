<script lang="ts">
	import type { FieldDescriptor } from './types';
	import * as Select from '@components/select';

	export let compact: boolean = false;
	export let field: FieldDescriptor;
	export let onChange: (path: string, value: unknown) => void;

	function handleNumberChange(e: Event) {
		const raw = (e.target as HTMLInputElement).value;
		const n = parseFloat(raw);
		if (!isNaN(n)) onChange(field.path, n);
	}

	function handleCharInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const first = input.value.charAt(0) || '';
		if (input.value.length > 1) input.value = first;
		if (first) onChange(field.path, first);
	}

	function handleStringChange(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		onChange(field.path, val);
	}

	function handleBooleanChange(e: Event) {
		onChange(field.path, (e.target as HTMLInputElement).checked);
	}

	function handleSelectChange(value: string) {
		onChange(field.path, value);
	}

	$: selectedValue = field.isMixed
		? undefined
		: { value: String(field.value ?? ''), label: String(field.value ?? '') };
</script>

{#if compact && (field.spec.type === 'number' || field.spec.type === 'enum' || field.spec.type === 'string')}
	<div
		class="flex items-center h-7 rounded-md border border-transparent bg-muted overflow-hidden transition-colors hover:border-border focus-within:border-primary focus-within:bg-background {field.spec.type === 'enum' ? 'col-span-2' : ''}"
		title={field.path}
	>
		<span class="pl-[7px] pr-1 text-[10px] font-medium text-muted-foreground select-none whitespace-nowrap shrink-0 min-w-[14px]">{field.label}</span>
		{#if field.spec.type === 'number'}
			<input
				class="flex-1 min-w-0 h-full border-none outline-none bg-transparent pr-1.5 pl-0.5 text-[11px] text-foreground [appearance:textfield]"
				type="number"
				value={field.isMixed ? '' : field.value}
				placeholder={field.isMixed ? '—' : undefined}
				min={field.spec.min}
				max={field.spec.max}
				step={field.spec.step ?? 1}
				on:change={handleNumberChange}
			/>
		{:else if field.spec.type === 'string'}
			<input
				class="flex-1 min-w-0 h-full border-none outline-none bg-transparent pr-1.5 pl-0.5 text-center text-[13px] font-mono text-foreground"
				type="text"
				value={field.isMixed ? '' : String(field.value ?? '')}
				placeholder={field.isMixed ? '—' : undefined}
				on:focus={(e: FocusEvent) => (e.target as HTMLInputElement).select()}
				on:input={handleCharInput}
			/>
		{:else if field.spec.type === 'enum'}
			<Select.Root
				selected={selectedValue}
				onSelectedChange={(s: { value: string } | undefined) => { if (s) handleSelectChange(s.value); }}
			>
				<Select.Trigger class="h-full border-0 bg-transparent shadow-none rounded-none px-1.5 py-0 text-[11px] focus:ring-0 focus:ring-offset-0">
					<Select.Value placeholder="—" />
				</Select.Trigger>
				<Select.Content>
					{#each field.spec.values as opt (opt)}
						<Select.Item value={opt} label={opt}>{opt}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		{/if}
	</div>
{:else}
	<div class="flex flex-col gap-1" title={field.path}>
		<span class="text-[10px] text-muted-foreground select-none">{field.label}</span>
		{#if field.spec.type === 'number'}
			<input
				class="h-7 w-full rounded-md border border-transparent bg-muted px-2 text-[11px] text-foreground outline-none transition-colors hover:border-border focus:border-primary focus:bg-background [appearance:textfield]"
				type="number"
				value={field.isMixed ? '' : field.value}
				placeholder={field.isMixed ? '—' : undefined}
				min={field.spec.min}
				max={field.spec.max}
				step={field.spec.step ?? 1}
				on:change={handleNumberChange}
			/>
		{:else if field.spec.type === 'string'}
			<input
				class="h-7 w-full rounded-md border border-transparent bg-muted px-2 text-[11px] text-foreground outline-none transition-colors hover:border-border focus:border-primary focus:bg-background"
				type="text"
				value={field.isMixed ? '' : String(field.value ?? '')}
				placeholder={field.isMixed ? 'Mixed' : undefined}
				on:change={handleStringChange}
			/>
		{:else if field.spec.type === 'boolean'}
			<label class="flex items-center gap-1.5 cursor-pointer">
				<input
					class="w-[13px] h-[13px] accent-primary"
					type="checkbox"
					checked={!field.isMixed && Boolean(field.value)}
					on:change={handleBooleanChange}
				/>
				<span class="text-[11px] text-foreground">{field.label}</span>
			</label>
		{:else if field.spec.type === 'enum'}
			<Select.Root
				selected={selectedValue}
				onSelectedChange={(s: { value: string } | undefined) => { if (s) handleSelectChange(s.value); }}
			>
				<Select.Trigger class="h-7 px-2 text-[11px] border-transparent bg-muted hover:border-border focus:border-primary focus:bg-background focus:ring-0 focus:ring-offset-0">
					<Select.Value placeholder="—" />
				</Select.Trigger>
				<Select.Content>
					{#each field.spec.values as opt (opt)}
						<Select.Item value={opt} label={opt}>{opt}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		{/if}
	</div>
{/if}
