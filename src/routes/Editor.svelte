<script lang="ts">
	import { onMount } from 'svelte';
	import CanvasKitInit from 'canvaskit-wasm';
	import { App, createAppInstance } from '@editor/app';
	import { type ConfigTheme } from '@editor/config';
	import { Camera } from '@editor/camera';
	import { BusManager } from '@editor/bus-manager';
	import { useLayerBus, useToolBus, useNotificationBus } from '@/bus';
	import { DocumentsApi } from '@/api';
	import {
		DrawTool,
		SelectTool,
		DrawShapeTool,
		ClipboardTool,
		TextTool,
		HistoryControlTool
	} from '@editor/tools';
	import { CameraControlTool } from '@editor/tools/camera-control';
	import { useTheme } from '@/theme/useTheme';
	import type { FontData } from '@editor/font';
	import { loader } from '@lib/load/load-manager';
	import { useDispatch } from '@store/useDispatch';
	import { getDocument } from '@store/slices/document';
	import wasmUrl from 'canvaskit-wasm/bin/canvaskit.wasm?url';
	import ConfigProvider from '@/config/ConfigProvider.svelte';
	import Notifier from '@views/Notifier/Notifier.svelte';
	import Tools from '@views/Tools/Tools.svelte';
	import SideMenu from '@views/SideMenu/SideMenu.svelte';
	import Actions from '@views/Actions/Actions.svelte';
	import type { CoreApi } from '@editor/core';
	import CoreProvider from '@/config/CoreProvider.svelte';
	import { ExportTool } from '@editor/tools/export/export-tool';
	import type { Theme } from '@/theme';

	const layer_bus = useLayerBus();
	const tools_bus = useToolBus();
	const notification_bus = useNotificationBus();

	const dispatch = useDispatch();

	const { theme, currentThemeRGBA } = useTheme();
	const editorThemes: { [x in 'light' | 'dark']: ConfigTheme } = {
		light: {
			background: [1, 1, 1, 1.0],
			grid: [0.9, 0.9, 0.9, 1.0],
			foreground: [0, 0, 0, 1.0],
			primary: [0.231, 0.51, 0.965, 1]
		},
		dark: {
			background: [0.1, 0.1, 0.1, 1.0],
			grid: [0.2, 0.2, 0.2, 1.0],
			foreground: [1, 1, 1, 1.0],
			primary: [0.231, 0.51, 0.965, 1]
		}
	};

	let core: CoreApi;

	onMount(async () => {
		const loadPromise = (async () => {
			const ckLoaded = CanvasKitInit({
				locateFile: () => wasmUrl
			});

			// WARNING: Hardcoded until multiple documents/document selection
			const __document = DocumentsApi.withDocument('__PROJECT__').getDocument();
			dispatch(getDocument('__PROJECT__'));

			let canvasContainer = document.getElementById('canvas-container');

			const gridCanvas = document.querySelector('#grid-canvas') as HTMLCanvasElement;
			gridCanvas.width = canvasContainer!.clientWidth;
			gridCanvas.height = canvasContainer!.clientHeight;

			const selectCanvas = document.querySelector('#selection-canvas') as HTMLCanvasElement;
			selectCanvas.width = canvasContainer!.clientWidth;
			selectCanvas.height = canvasContainer!.clientHeight;

			const animationCanvas = document.querySelector('#animation-canvas') as HTMLCanvasElement;
			animationCanvas.width = canvasContainer!.clientWidth;
			animationCanvas.height = canvasContainer!.clientHeight;

			[canvasContainer, gridCanvas, selectCanvas, animationCanvas].map((item) =>
				item!.addEventListener('contextmenu', (e) => {
					e.preventDefault();
					e.stopPropagation();
					return false;
				})
			);

			ckLoaded.then(async (canvasKit) => {
				async function loadFont(url: string, family: string): Promise<FontData> {
					const response = await fetch(url);
					if (!response.ok) {
						throw new Error(`Failed to load font from ${url}`);
					}

					const buffer = await response.arrayBuffer();
					return { buffer, family };
				}

				const busManager = new BusManager({
					layers: layer_bus,
					tools: tools_bus,
					notifications: notification_bus
				});

				const ratio = window.devicePixelRatio || 1;
				const camera = new Camera(
					canvasContainer!.clientWidth * ratio,
					canvasContainer!.clientHeight * ratio
				);

				let app: App;

				function resizeCanvases() {
					const width = canvasContainer!.clientWidth;
					const height = canvasContainer!.clientHeight;
					const ratio = window.devicePixelRatio || 1;

					[gridCanvas, selectCanvas, animationCanvas].forEach((canvas) => {
						canvas.width = width * ratio;
						canvas.height = height * ratio;
						canvas.style.width = `${width}px`;
						canvas.style.height = `${height}px`;
					});

					camera.setDimensions(width * ratio, height * ratio);
					app?.resizeCanvases();
				}

				resizeCanvases();
				window.addEventListener('resize', resizeCanvases);
				window
					.matchMedia('screen and (resolution: 1dppx)')
					.addEventListener('change', resizeCanvases);

				const font = await loadFont('/fonts/LiberationMono-Regular.ttf', 'Liberation Mono');

				const [coreApi, appInstance] = createAppInstance({
					canvasKitInstance: canvasKit,
					busManager,
					camera,
					gridCanvasElement: gridCanvas,
					selectCanvasElement: selectCanvas,
					asciiCanvasElement: animationCanvas,
					font
				});

				core = coreApi;

				app = appInstance;

				const toolExport = new ExportTool(coreApi);

				const updateTheme = (theme: Theme) => {
					app.getConfig().setTheme({
						...app.getConfig().getTheme(),
						...editorThemes[theme]
					});

					toolExport.setTheme({
						primary: $currentThemeRGBA['--primary-export']
					});
				};
				updateTheme($theme);

				const drawTool = new DrawTool(coreApi);
				const selectTool = new SelectTool(coreApi);
				const drawShapeTool = new DrawShapeTool(coreApi);
				const textTool = new TextTool(coreApi);
				const clipboardTool = new ClipboardTool(coreApi);
				const historyControlTool = new HistoryControlTool(coreApi);
				const cameraControlTool = new CameraControlTool(coreApi);

				app.registerTool(selectTool);
				app.registerTool(drawTool);
				app.registerTool(drawShapeTool);
				app.registerTool(textTool);
				app.registerTool(clipboardTool);
				app.registerTool(historyControlTool);
				app.registerTool(cameraControlTool);
				app.registerTool(toolExport);

				const toolManager = app.getToolManager();
				toolManager.setDefaultTool(selectTool);

				theme.subscribe((theme) => {
					updateTheme(theme);
				});

				window.addEventListener('resize', () => app.render());

				if (__document) {
					app.hydratateDocument(__document);
				}

				app.render();
			});
		})();
		loader.register([loadPromise]);
	});
</script>

<main>
	<div role="main" id="canvas-container">
		<canvas id="grid-canvas" width="1920" height="1080"></canvas>
		<canvas id="animation-canvas" width="1920" height="1080"></canvas>
		<canvas id="selection-canvas" width="1920" height="1080"></canvas>
	</div>
</main>

{#if core}
	<CoreProvider coreApi={core}>
		<ConfigProvider config={core.getConfig()}>
			<Notifier />
			<Tools />
			<SideMenu />
			<Actions />
		</ConfigProvider>
	</CoreProvider>
{/if}

<style>
	#canvas-container {
		position: relative;
		width: 100vw;
		height: 100vh;
		user-select: none;
		background-color: hsl(--primary-foreground);
	}
	canvas {
		position: absolute;
		top: 0;

		left: 0;
		width: 100%;
		height: 100%;
		display: block;
		transform-origin: top left;
		cursor: inherit;
	}
</style>
