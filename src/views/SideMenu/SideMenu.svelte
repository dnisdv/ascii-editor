<script>
	import Project from './Project.svelte';
	import Layers from './Layers.svelte';
</script>

<div class="left-sidemenu z-50 flex flex-col">
	<Project />
	<div class="left-sidemenu_delimiter"></div>
	<Layers class="flex min-h-0 flex-grow flex-col" />
</div>

<style lang="postcss">
	.left-sidemenu {
		width: 216px;
		background: hsl(var(--background));
		border-radius: 12px;
		position: fixed;
		top: 16px;
		left: 16px;
		border: 1px solid hsl(var(--border));
		max-height: calc(100vh - 32px);
		min-height: 0;
		height: auto;
	}

	.left-sidemenu_delimiter {
		height: 1px;
		background-color: hsl(var(--border));
		margin: 12px 0px 8px 0px;
	}
</style>
