<script lang="ts">
	import * as Popover from '@components/popover';
	import { ScrollArea } from '@components/scroll-area';
	import { Separator } from '@components/separator';
	import * as ToggleGroup from '@components/toggle-group';
	import { writable } from 'svelte/store';

	export let onSymbolChange: (symbol: string) => void;
	let open = false;

	const symbols = [
		'!',
		'@',
		'#',
		'$',
		'%',
		'^',
		'&',
		'*',
		'(',
		')',
		'_',
		'+',
		'-',
		'=',
		'{',
		'}',
		'[',
		']',
		'|',
		'\\',
		':',
		';',
		'"',
		"'",
		'<',
		'>',
		',',
		'.',
		'?',
		'/',
		'~',
		'`',
		'€',
		'‚',
		'ƒ',
		'„',
		'…',
		'†',
		'‡',
		'ˆ',
		'‰',
		'Š',
		'‹',
		'Œ',
		'Ž',
		'‘',
		'’',
		'“',
		'”',
		'•',
		'–',
		'—',
		'˜',
		'™',
		'š',
		'›',
		'œ',
		'ž',
		'Ÿ',
		'¡',
		'¢',
		'£',
		'¤',
		'¥',
		'¦',
		'§',
		'¨',
		'©',
		'ª',
		'«',
		'¬',
		'­',
		'®',
		'¯',
		'°',
		'±',
		'²',
		'³',
		'´',
		'µ',
		'¶',
		'·',
		'¸',
		'¹',
		'º',
		'»',
		'¼',
		'½',
		'¾',
		'¿',
		'À',
		'Á',
		'Â',
		'Ã',
		'Ä',
		'Å',
		'Æ',
		'Ç',
		'È',
		'É',
		'Ê',
		'Ë',
		'Ì',
		'Í',
		'Î',
		'Ï',
		'Ð',
		'Ñ',
		'Ò',
		'Ó',
		'Ô',
		'Õ',
		'Ö',
		'×',
		'Ø',
		'Ù',
		'Ú',
		'Û',
		'Ü',
		'Ý',
		'Þ',
		'ß',
		'à',
		'á',
		'â',
		'ã',
		'ä',
		'å',
		'æ',
		'ç',
		'è',
		'é',
		'ê',
		'ë',
		'ì',
		'í',
		'î',
		'ï',
		'ð',
		'ñ',
		'ò',
		'ó',
		'ô',
		'õ',
		'ö',
		'÷',
		'ø',
		'ù',
		'ú',
		'û',
		'ü',
		'ý',
		'þ',
		'ÿ'
	];

	const letters = [
		'A',
		'B',
		'C',
		'D',
		'E',
		'F',
		'G',
		'H',
		'I',
		'J',
		'K',
		'L',
		'M',
		'N',
		'O',
		'P',
		'Q',
		'R',
		'S',
		'T',
		'U',
		'V',
		'W',
		'X',
		'Y',
		'Z',
		'a',
		'b',
		'c',
		'd',
		'e',
		'f',
		'g',
		'h',
		'i',
		'j',
		'k',
		'l',
		'm',
		'n',
		'o',
		'p',
		'q',
		'r',
		's',
		't',
		'u',
		'v',
		'w',
		'x',
		'y',
		'z'
	];

	export let selectedSymbol = writable('');
	export let viewPort = writable<Element | null>(null);
	const scrollPosition = writable(0);

	const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

	let symbolsSection: HTMLDivElement;
	let lettersSection: HTMLDivElement;
	let numbersSection: HTMLDivElement;

	const onSectionCategoryChange = (section: string) => {
		switch (section) {
			case 'letters':
				scrollToSection(lettersSection);
				break;
			case 'numbers':
				scrollToSection(numbersSection);
				break;
			case 'symbols':
				scrollToSection(symbolsSection);
				break;
		}
	};

	function scrollToSection(section: HTMLDivElement) {
		section?.scrollIntoView({ behavior: 'smooth' });
	}

	function handleScroll(event: Event) {
		const target = event.target as HTMLElement;
		scrollPosition.set(target.scrollTop);

		const scrollTop = target.scrollTop;
		const numbersSectionScroll = numbersSection.offsetTop;
		const symbolsSectionScroll = symbolsSection.offsetTop;
		const buffer = 50;

		if (scrollTop < numbersSectionScroll - buffer) {
			sectionCategory.set('letters');
		} else if (
			scrollTop >= numbersSectionScroll - buffer &&
			scrollTop < symbolsSectionScroll - buffer
		) {
			sectionCategory.set('numbers');
		} else {
			sectionCategory.set('symbols');
		}
	}

	function onSelectSymbol(symbol: string | undefined) {
		if (!symbol) return;

		selectedSymbol.set(symbol);
		onSymbolChange(symbol);
		open = false;
	}

	const sectionCategory = writable('letters');

	viewPort.subscribe(() => {
		const pos = $scrollPosition;
		if (pos && $viewPort) {
			setTimeout(() => {
				$viewPort.scrollTo({ top: pos, behavior: 'smooth' });
			});
		}
	});
</script>

<Popover.Root bind:open>
	<Popover.Trigger class="h-full">
		<slot />
	</Popover.Trigger>
	<Popover.Content class="flex h-2/3 w-[432px] flex-col items-start overflow-hidden px-0 pb-0 pt-0">
		<ToggleGroup.Root
			class=" sticky flex gap-4  pl-4 pt-4 text-base"
			variant="hover"
			value={$sectionCategory}
			onValueChange={(value: string) => onSectionCategoryChange(value)}
			size="auto"
			type="single"
		>
			<ToggleGroup.Item
				class="relative pr-5"
				value="letters"
				on:click={() => scrollToSection(lettersSection)}
				aria-label="select letters"
				>letters
				<div class="overlay-symbols">ABC</div></ToggleGroup.Item
			>
			<ToggleGroup.Item
				class="relative pr-3.5"
				value="numbers"
				on:click={() => scrollToSection(numbersSection)}
				aria-label="select numbers"
				>numbers
				<div class="overlay-symbols">123</div></ToggleGroup.Item
			>
			<ToggleGroup.Item
				class="relative pr-5"
				value="symbols"
				on:click={() => scrollToSection(symbolsSection)}
				aria-label="select symbols"
				>symbols
				<div class="overlay-symbols">!@&</div></ToggleGroup.Item
			>
		</ToggleGroup.Root>

		<Separator class="mx-4 mt-4 box-border" />

		<ScrollArea bind:viewPort onScroll={handleScroll} data-scroll-area-root="awdawdaw">
			<ToggleGroup.Root
				class="flex h-full flex-col items-start gap-6  pl-2 pt-4"
				size="icon"
				value={$selectedSymbol}
				onValueChange={(value: string) => onSelectSymbol(value)}
				type="single"
			>
				<div class="symbols-group" bind:this={lettersSection}>
					<p class="symbols_title">Letters</p>
					{#each letters as letter (letter)}
						<ToggleGroup.Item value={letter} aria-label={`select ${letter}`}>
							{letter}
						</ToggleGroup.Item>
					{/each}
				</div>
				<div bind:this={numbersSection}>
					<p class="symbols_title">Numbers</p>
					{#each numbers as number (number)}
						<ToggleGroup.Item value={number} aria-label={`select ${number}`}>
							{number}
						</ToggleGroup.Item>
					{/each}
				</div>
				<div bind:this={symbolsSection}>
					<p class="symbols_title">Symbols</p>
					{#each symbols as symbol (symbol)}
						<ToggleGroup.Item value={symbol} aria-label={`select ${symbol}`}>
							{symbol}
						</ToggleGroup.Item>
					{/each}
				</div>
			</ToggleGroup.Root>
		</ScrollArea>
	</Popover.Content>
</Popover.Root>

<style lang="postcss">
	.symbols-group {
		font-family: 'Liberation Mono', serif;
		font-optical-sizing: auto;
		font-weight: 400;
		font-style: normal;
	}
	.symbols_title {
		@apply mb-1.5 ml-2 text-xs font-medium tracking-tighter opacity-70;
	}

	.overlay-symbols {
		@apply absolute -top-1 right-0 whitespace-nowrap text-[10px] font-bold tracking-tighter;
	}
</style>
