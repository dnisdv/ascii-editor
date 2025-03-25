<script>
	export const ssr = false;
	import SideMenu from '@views/SideMenu/SideMenu.svelte';
	import Tools from '@views/Tools/Tools.svelte';
	import Editor from './Editor.svelte';
	import Actions from '@views/Actions/Actions.svelte';
	import Notifier from '@views/Notifier/Notifier.svelte';
	import LoadingPage from '@views/LoadingPage.svelte';
</script>

<LoadingPage />

<Notifier />
<Tools />
<SideMenu />
<Actions />
<Editor />
