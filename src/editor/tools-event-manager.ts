import type { BaseTool } from '@editor/tool';
import { VimKeyMapper } from '@editor/utils/hotkey';
import type { ICanvas } from './types';

export interface ToolManagerOptions {
	canvas: ICanvas;
}

type EventHandler = (
	event: Event | MouseEvent | KeyboardEvent | WheelEvent
) => boolean | void | Promise<void>;

type SpecificMouseEventHandler = (event: MouseEvent) => void | Promise<void>;
type SpecificKeyboardEventHandler = (event: KeyboardEvent) => void | Promise<void>;
type SpecificWheelEventHandler = (event: WheelEvent) => void | Promise<void>;
type SpecificGenericEventHandler = (event: Event) => void | Promise<void>;

export class ToolEventManager {
	private keyEventMap: Map<string, { tool: BaseTool; handler: EventHandler }[]> = new Map();
	private mouseEventMap: Map<string, { tool: BaseTool; handler: EventHandler }[]> = new Map();
	private customEventMap: Map<string, { tool: BaseTool; handler: EventHandler }[]> = new Map();
	private tools: Map<string, BaseTool> = new Map();
	private isMouseInsideCanvas = true;
	private lastMousePosition: { x: number; y: number } | null = null;

	constructor(private canvas: ICanvas) {
		this.registerDefaultListeners();
		setTimeout(() => this._checkInitialMousePosition(), 0);
	}

	public registerTool(tool: BaseTool) {
		this.tools.set(tool.name, tool);
	}

	public removeToolEvents(tool: BaseTool) {
		const toolName = tool.name;

		this._removeToolEvents(toolName, this.keyEventMap);
		this._removeToolEvents(toolName, this.mouseEventMap);
		this._removeToolEvents(toolName, this.customEventMap);
	}

	public unregisterTool(toolName: string) {
		this.tools.delete(toolName);
		this._removeToolEvents(toolName, this.keyEventMap);
		this._removeToolEvents(toolName, this.mouseEventMap);
		this._removeToolEvents(toolName, this.customEventMap);
	}

	public toolApi(tool: BaseTool) {
		const getEventKey = (eventType: string, global: boolean, key: string | null = null) => {
			const prefix = global ? 'global:' : '';
			return key ? `${prefix}${eventType}:${key}` : `${prefix}${eventType}`;
		};

		return {
			removeToolEvents: () => this.removeToolEvents(tool),

			registerKeyPress: (
				key: string | RegExp,
				handler: SpecificKeyboardEventHandler,
				global = false
			) => {
				const keyPattern = key instanceof RegExp ? key.source : key;
				this._registerEvent(
					tool,
					this.keyEventMap,
					getEventKey('keydown', global, keyPattern),
					handler as EventHandler
				);
			},
			registerKeyUp: (key: string, handler: SpecificKeyboardEventHandler, global = false) =>
				this._registerEvent(
					tool,
					this.keyEventMap,
					getEventKey('keyup', global, key),
					handler as EventHandler
				),
			unregisterKeyPress: (key: string, global = false) =>
				this._unregisterEvent(tool, this.keyEventMap, getEventKey('keydown', global, key)),
			unregisterKeyUp: (key: string, global = false) =>
				this._unregisterEvent(tool, this.keyEventMap, getEventKey('keyup', global, key)),

			registerLeftClick: (handler: SpecificMouseEventHandler, global = false) =>
				this._registerEvent(
					tool,
					this.mouseEventMap,
					getEventKey('leftclick', global),
					handler as EventHandler
				),
			registerRightClick: (handler: SpecificMouseEventHandler, global = false) =>
				this._registerEvent(
					tool,
					this.mouseEventMap,
					getEventKey('rightclick', global),
					handler as EventHandler
				),

			registerMouseDown: (
				button: 'left' | 'right',
				handler: SpecificMouseEventHandler,
				global = false
			) =>
				this._registerEvent(
					tool,
					this.mouseEventMap,
					getEventKey(`mousedown:${button}`, global),
					handler as EventHandler
				),

			registerMouseMove: (handler: SpecificMouseEventHandler, global = true) =>
				this._registerEvent(
					tool,
					this.mouseEventMap,
					getEventKey('mousemove', global),
					handler as EventHandler
				),
			registerMouseUp: (handler: SpecificMouseEventHandler, global = true) => {
				this._registerEvent(
					tool,
					this.mouseEventMap,
					getEventKey('mouseup', global),
					handler as EventHandler
				);
			},
			registerMouseLeave: (handler: SpecificMouseEventHandler, global = false) =>
				this._registerEvent(
					tool,
					this.mouseEventMap,
					getEventKey('mouseleave', global),
					handler as EventHandler
				),

			unregisterMouseLeave: (global = false) =>
				this._unregisterEvent(tool, this.mouseEventMap, getEventKey('mouseleave', global)),
			unregisterMouseMove: (global = true) =>
				this._unregisterEvent(tool, this.mouseEventMap, getEventKey('mousemove', global)),
			unregisterMouseUp: (global = true) =>
				this._unregisterEvent(tool, this.mouseEventMap, getEventKey('mouseup', global)),
			unregisterLeftClick: (global = false) =>
				this._unregisterEvent(tool, this.mouseEventMap, getEventKey('leftclick', global)),
			unregisterRightClick: (global = false) =>
				this._unregisterEvent(tool, this.mouseEventMap, getEventKey('rightclick', global)),
			unregisterMouseDown: (button: 'left', global = false) =>
				this._unregisterEvent(tool, this.mouseEventMap, getEventKey(`mousedown:${button}`, global)),

			registerWheel: (handler: SpecificWheelEventHandler, global = false) =>
				this._registerEvent(
					tool,
					this.mouseEventMap,
					getEventKey('wheel', global),
					handler as EventHandler
				),
			unregisterWheel: (global = false) =>
				this._unregisterEvent(tool, this.mouseEventMap, getEventKey('wheel', global)),

			registerUnload: (handler: SpecificGenericEventHandler) =>
				this._registerEvent(tool, this.customEventMap, 'unload', handler as EventHandler),
			unregisterUnload: () => this._unregisterEvent(tool, this.customEventMap, 'unload')
		};
	}

	private _checkInitialMousePosition() {
		if (!this.lastMousePosition) {
			this.isMouseInsideCanvas = false;
			return;
		}

		const rect = this.canvas.canvas.getBoundingClientRect();
		const { x, y } = this.lastMousePosition;

		this.isMouseInsideCanvas =
			x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
	}

	private _registerEvent(
		tool: BaseTool,
		eventMap: Map<string, { tool: BaseTool; handler: EventHandler }[]>,
		eventKey: string,
		handler: EventHandler
	) {
		if (!eventMap.has(eventKey)) eventMap.set(eventKey, []);
		eventMap.set(
			eventKey,
			eventMap.get(eventKey)!.filter(({ tool: t }) => t.name !== tool.name)
		);
		eventMap.get(eventKey)!.unshift({ tool, handler });
	}

	private _unregisterEvent(
		tool: BaseTool,
		eventMap: Map<string, { tool: BaseTool; handler: EventHandler }[]>,
		eventKey: string
	) {
		if (eventMap.has(eventKey)) {
			eventMap.set(
				eventKey,
				eventMap.get(eventKey)!.filter(({ tool: t }) => t.name !== tool.name)
			);
		}
	}

	private _removeToolEvents(
		toolName: string,
		eventMap: Map<string, { tool: BaseTool; handler: EventHandler }[]>
	) {
		for (const [eventKey, handlers] of eventMap.entries()) {
			eventMap.set(
				eventKey,
				handlers.filter(({ tool }) => tool.name !== toolName)
			);
		}
	}

	private registerDefaultListeners() {
		const selectCanvas = this.canvas.canvas;

		document.addEventListener('keydown', (e) => this._dispatchKeyboardEvent('keydown', e));
		document.addEventListener('keyup', (e) => this._dispatchKeyboardEvent('keyup', e));
		window.addEventListener('beforeunload', (e) => this._dispatchCustomEvent('unload', e));

		selectCanvas.addEventListener('wheel', (e) => this._dispatchMouseEvent('wheel', e, false));
		selectCanvas.addEventListener('mousedown', (e) =>
			this._dispatchMouseEvent('mousedown', e, false)
		);
		selectCanvas.addEventListener('mousemove', (e) =>
			this._dispatchMouseEvent('mousemove', e, false)
		);
		selectCanvas.addEventListener('mouseleave', (e) =>
			this._dispatchMouseEvent('mouseleave', e, false)
		);
		selectCanvas.addEventListener('mouseup', (e) => this._dispatchMouseEvent('mouseup', e, false));
		selectCanvas.addEventListener('dblclick', (e) =>
			this._dispatchMouseEvent('doubleclick', e, false)
		);
		selectCanvas.addEventListener('contextmenu', (e) =>
			this._dispatchMouseEvent('rightclick', e, false)
		);
		selectCanvas.addEventListener('click', (e) => this._dispatchMouseEvent('leftclick', e, false));

		window.addEventListener('mousedown', (e) => this._dispatchMouseEvent('mousedown', e, true));
		window.addEventListener('mousemove', (e) => this._dispatchMouseEvent('mousemove', e, true));
		window.addEventListener('mouseup', (e) => this._dispatchMouseEvent('mouseup', e, true));
		window.addEventListener('wheel', (e) => this._dispatchMouseEvent('wheel', e, true));
		window.addEventListener('click', (e) => this._dispatchMouseEvent('leftclick', e, true));
		window.addEventListener('contextmenu', (e) => this._dispatchMouseEvent('rightclick', e, true));

		selectCanvas.addEventListener('mouseenter', () => {
			this.isMouseInsideCanvas = true;
		});
		selectCanvas.addEventListener('mouseleave', (e) => {
			this.isMouseInsideCanvas = false;
			this._dispatchMouseEvent('mouseleave', e, false);
		});
	}

	private _dispatchCustomEvent(eventType: string, event: Event) {
		const handlers = this.customEventMap.get(eventType);
		if (!handlers || handlers.length === 0) return;

		for (const { handler } of handlers) {
			handler(event);
		}
	}

	private _dispatchKeyboardEvent(eventType: string, event: KeyboardEvent) {
		if (event.altKey) {
			return;
		}

		const vimKey = VimKeyMapper.normalizeKeyEvent(event);

		const exactLocalKey = `${eventType}:${vimKey}`;
		const exactGlobalKey = `global:${eventType}:${vimKey}`;
		const handlersToExecute: { tool: BaseTool; handler: EventHandler }[] = [];

		const exactGlobalHandlers = this.keyEventMap.get(exactGlobalKey) || [];
		handlersToExecute.push(...exactGlobalHandlers);

		if (this.isMouseInsideCanvas) {
			const exactLocalHandlers = this.keyEventMap.get(exactLocalKey) || [];
			handlersToExecute.push(...exactLocalHandlers);
		}

		if (handlersToExecute.length === 0) {
			for (const [key, handlers] of this.keyEventMap.entries()) {
				const isGlobal = key.startsWith('global:');
				const prefix = isGlobal ? `global:${eventType}:` : `${eventType}:`;

				if (key.startsWith(prefix)) {
					const pattern = key.substring(prefix.length);
					if (pattern === vimKey) continue;

					try {
						if (new RegExp(pattern).test(vimKey)) {
							handlersToExecute.push(...handlers);
						}
					} catch (err) {
						console.warn(`Invalid regex: ${pattern}`, err);
					}
				}
			}
		}

		if (handlersToExecute.length > 0) {
			event.preventDefault();
			event.stopPropagation();
		}

		const executedHandlers = new Set<EventHandler>();
		for (const { handler } of handlersToExecute) {
			if (!executedHandlers.has(handler)) {
				handler(event);
				executedHandlers.add(handler);
			}
		}
	}

	private _dispatchMouseEvent(eventType: string, event: MouseEvent, isGlobal: boolean) {
		const dispatch = (baseEventType: string) => {
			const localKey = `${baseEventType}`;
			const globalKey = `global:${baseEventType}`;

			const localHandlers = this.mouseEventMap.get(localKey) || [];
			const globalHandlers = this.mouseEventMap.get(globalKey) || [];

			if (!isGlobal) {
				for (const { handler } of localHandlers) {
					handler(event);
				}
			}

			for (const { handler } of globalHandlers) handler(event);
		};

		if (
			eventType === 'mousemove' ||
			eventType === 'mouseup' ||
			eventType === 'mouseleave' ||
			eventType === 'wheel'
		) {
			dispatch(eventType);
			return;
		}

		const button = event.button === 0 ? 'left' : event.button === 2 ? 'right' : null;
		if (!button) return;

		dispatch(`${eventType}:${button}`);
	}
}
