<script lang="ts">
	import { onMount } from 'svelte';
	import CanvasKitInit from 'canvaskit-wasm';
	import { App, createAppInstance } from '@editor/app';
	import { type ConfigTheme } from '@editor/config';
	import { Camera } from '@editor/camera';
	import {
		DrawTool,
		SelectTool,
		DrawShapeTool,
		TextTool,
		HistoryControlTool,
		ContextMenuTool
	} from '@editor/tools';
	import { CameraControlTool } from '@editor/tools/camera-control';
	import { useTheme } from '@/theme/useTheme';
	import type { FontData } from '@editor/font';
	import { loader } from '@lib/load/load-manager';
	import wasmUrl from 'canvaskit-wasm/bin/canvaskit.wasm?url';
	import ConfigProvider from '@/config/ConfigProvider.svelte';
	import Notifier from '@views/Notifier/Notifier.svelte';
	import Tools from '@views/Tools/Tools.svelte';
	import SideMenu from '@views/SideMenu/SideMenu.svelte';
	import Actions from '@views/Actions/Actions.svelte';
	import EditorContextMenu from '@views/ContextMenu/EditorContextMenu.svelte';
	import type { CoreApi } from '@editor/core';
	import { registerDefaultCommands } from '@editor/commands/register-default';

	import CoreProvider from '@/config/CoreProvider.svelte';
	import { ExportTool } from '@editor/tools/export/export-tool';
	import type { Theme } from '@/theme';
	import { RectangleObject } from '@editor/tools/shape/rectangle-object';
	import { LineObject } from '@editor/tools/shape/line-object';
	import { Project } from '@/project/project';
	import { useDispatch } from '@store/useDispatch';
	import { useSelector } from '@store/useSelector';
	import { toggleGrid, toggleUI } from '@store/slices/ui/ui.slice';
	import { EditorCommand } from '@editor/commands/ids';
	import { contextMenuService } from '@/views/ContextMenu/service-instance';
	import type { MenuContext } from '@editor/context-menu';

	const { theme, currentThemeRGBA } = useTheme();
	const dispatch = useDispatch();
	const uiVisible = useSelector((state) => state.ui.visible);
	const gridVisible = useSelector((state) => state.ui.gridVisible);

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
	$: if (core) {
		core.getUI().toggleGrid($gridVisible);
	}
	let currentProject: Project | null = null;

	onMount(async () => {
		const loadPromise = (async () => {
			const ckLoaded = CanvasKitInit({
				locateFile: () => wasmUrl
			});

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

				const ratio = window.devicePixelRatio || 1;
				const camera = new Camera(
					canvasContainer!.clientWidth * ratio,
					canvasContainer!.clientHeight * ratio
				);

				let app: App;

				function resizeCanvases() {
					if (!canvasContainer) return;
					const width = canvasContainer.clientWidth;
					const height = canvasContainer.clientHeight;

					if (width === 0 || height === 0) return;

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
					camera,
					gridCanvasElement: gridCanvas,
					selectCanvasElement: selectCanvas,
					asciiCanvasElement: animationCanvas,
					font
				});

				core = coreApi;

				app = appInstance;

				const documentId = '__PROJECT__';
				currentProject = new Project(documentId, coreApi);

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
				const historyControlTool = new HistoryControlTool(coreApi);
				const cameraControlTool = new CameraControlTool(coreApi);
				const contextMenuTool = new ContextMenuTool(coreApi);

				app.registerTool(selectTool);
				app.registerTool(drawTool);
				app.registerTool(drawShapeTool);
				app.registerTool(textTool);
				app.registerTool(historyControlTool);
				app.registerTool(cameraControlTool);
				app.registerTool(toolExport);
				app.registerTool(contextMenuTool);

				app.registerObject('rectangle', RectangleObject);
				app.registerObject('line', LineObject);

				registerDefaultCommands(core.getCommands(), core);

				core.getCommandRegistry().register(EditorCommand.ViewToggleUI, () => dispatch(toggleUI()));
				core
					.getCommandRegistry()
					.register(EditorCommand.ViewToggleGrid, () => dispatch(toggleGrid()));
				core.getCommandRegistry().register(EditorCommand.ViewThemeSet, (args: unknown) => {
					const _args = args as { theme: Theme };
					if (_args && _args.theme) {
						theme.set(_args.theme);
					}
				});

				core.getCommandRegistry().register(EditorCommand.ViewShowContextMenu, (args: unknown) => {
					const _args = args as { x: number; y: number; context: MenuContext };
					contextMenuService.showAt(_args.x, _args.y, _args.context);
				});

				const toolManager = app.getToolManager();
				toolManager.setDefaultTool(selectTool);

				theme.subscribe((theme) => {
					updateTheme(theme);
				});

				currentProject.startSyncing();

				window.addEventListener('resize', () => app.render());
				app.hydratateDocument(currentProject.documentSchema());
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
			<EditorContextMenu />
			<div class={$uiVisible ? 'contents' : 'hidden'}>
				<Notifier />
				<Tools />
				<SideMenu />
				<Actions />
			</div>
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
