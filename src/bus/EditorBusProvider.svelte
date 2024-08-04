<script context="module">
</script>

<script lang="ts">
	import { useStore } from '@store/useStore';
	import { setContext } from 'svelte';

	import {
		EDITOR_LAYERS_BUS_KEY,
		EDITOR_PLUGINS_BUS_KEY,
		EDITOR_NOTIFICATION_BUS_KEY
	} from './config';

	import { EditorToolsBus } from './editor-tools.bus';
	import { EditorLayersBus } from './editor-layers.bus';
	import { EditorNotificationBus } from './editor-notifications.bus';

	const store = useStore();

	const toolBus = new EditorToolsBus(store);
	const layerBus = new EditorLayersBus(store);
	const notificationBus = new EditorNotificationBus();

	setContext(EDITOR_LAYERS_BUS_KEY, layerBus);
	setContext(EDITOR_PLUGINS_BUS_KEY, toolBus);
	setContext(EDITOR_NOTIFICATION_BUS_KEY, notificationBus);
</script>

<slot />
