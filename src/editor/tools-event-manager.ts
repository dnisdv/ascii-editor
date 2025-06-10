import type { BaseTool } from '@editor/tool';
import { VimKeyMapper } from '@editor/utils/hotkey';
import type { ICanvas } from './types';

export interface ToolManagerOptions {
	canvas: ICanvas;
}

type EventHandler = (
	event: Event | MouseEvent | KeyboardEvent | WheelEvent
) => boolean | void | Promise<void>;

type SpecificMouseEventHandler = (event: MouseEvent) => boolean | void | Promise<void>;
type SpecificKeyboardEventHandler = (event: KeyboardEvent) => boolean | void | Promise<void>;
type SpecificWheelEventHandler = (event: WheelEvent) => boolean | void | Promise<void>;
type SpecificGenericEventHandler = (event: Event) => boolean | void | Promise<void>;

export class ToolEventManager {
	private keyEventMap: Map<string, { tool: BaseTool; handler: EventHandler }[]> = new Map();
	private mouseEventMap: Map<string, { tool: BaseTool; handler: EventHandler }[]> = new Map();
	private customEventMap: Map<string, { tool: BaseTool; handler: EventHandler }[]> = new Map();
	private tools: Map<string, BaseTool> = new Map();

	constructor(private canvas: ICanvas) {
		this.registerDefaultListeners();
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
		return {
			removeToolEvents: () => this.removeToolEvents(tool),

			registerKeyPress: (key: string | RegExp, handler: SpecificKeyboardEventHandler) => {
				const keyPattern = key instanceof RegExp ? key.source : key;
				this._registerEvent(tool, this.keyEventMap, 'keydown', keyPattern, handler as EventHandler);
			},
			registerKeyUp: (key: string, handler: SpecificKeyboardEventHandler) =>
				this._registerEvent(tool, this.keyEventMap, 'keyup', key, handler as EventHandler),
			unregisterKeyPress: (key: string) =>
				this._unregisterEvent(tool, this.keyEventMap, 'keydown', key),
			unregisterKeyUp: (key: string) => this._unregisterEvent(tool, this.keyEventMap, 'keyup', key),

			registerLeftClick: (handler: SpecificMouseEventHandler) =>
				this._registerEvent(tool, this.mouseEventMap, 'leftclick', null, handler as EventHandler),
			registerRightClick: (handler: SpecificMouseEventHandler) =>
				this._registerEvent(tool, this.mouseEventMap, 'rightclick', null, handler as EventHandler),

			registerMouseDown: (button: 'left' | 'right', handler: SpecificMouseEventHandler) =>
				this._registerEvent(
					tool,
					this.mouseEventMap,
					`mousedown:${button}`,
					null,
					handler as EventHandler
				),

			registerMouseMove: (handler: SpecificMouseEventHandler) =>
				this._registerEvent(tool, this.mouseEventMap, 'mousemove', null, handler as EventHandler),
			registerMouseUp: (handler: SpecificMouseEventHandler) => {
				this._registerEvent(tool, this.mouseEventMap, 'mouseup', null, handler as EventHandler);
			},
			registerMouseLeave: (handler: SpecificMouseEventHandler) =>
				this._registerEvent(tool, this.mouseEventMap, 'mouseleave', null, handler as EventHandler),

			unregisterMouseLeave: () =>
				this._unregisterEvent(tool, this.mouseEventMap, 'mouseleave', null),
			unregisterMouseMove: () => this._unregisterEvent(tool, this.mouseEventMap, 'mousemove', null),
			unregisterMouseUp: () => this._unregisterEvent(tool, this.mouseEventMap, 'mouseup', null),
			unregisterLeftClick: () => this._unregisterEvent(tool, this.mouseEventMap, 'leftclick', null),
			unregisterRightClick: () =>
				this._unregisterEvent(tool, this.mouseEventMap, 'rightclick', null),
			unregisterMouseDown: (button: 'left') =>
				this._unregisterEvent(tool, this.mouseEventMap, `mousedown:${button}`, null),

			registerWheel: (handler: SpecificWheelEventHandler) =>
				this._registerEvent(tool, this.mouseEventMap, 'wheel', null, handler as EventHandler),
			unregisterWheel: () => this._unregisterEvent(tool, this.mouseEventMap, 'wheel', null),

			registerUnload: (handler: SpecificGenericEventHandler) =>
				this._registerEvent(tool, this.customEventMap, 'unload', null, handler as EventHandler),
			unregisterUnload: () => this._unregisterEvent(tool, this.customEventMap, 'unload', null),

			registerCustomEvent: (eventName: string, handler: SpecificGenericEventHandler) =>
				this._registerEvent(tool, this.customEventMap, eventName, null, handler as EventHandler),
			unregisterCustomEvent: (eventName: string) =>
				this._unregisterEvent(tool, this.customEventMap, eventName, null)
		};
	}

	private _registerEvent(
		tool: BaseTool,
		eventMap: Map<string, { tool: BaseTool; handler: EventHandler }[]>,
		eventType: string,
		key: string | null,
		handler: EventHandler
	) {
		const eventKey = key ? `${eventType}:${key}` : eventType;
		if (!eventMap.has(eventKey)) {
			eventMap.set(eventKey, []);
		}
		eventMap.set(
			eventKey,
			eventMap.get(eventKey)!.filter(({ tool: t }) => t.name !== tool.name)
		);
		eventMap.get(eventKey)!.unshift({ tool, handler });
	}

	private _unregisterEvent(
		tool: BaseTool,
		eventMap: Map<string, { tool: BaseTool; handler: EventHandler }[]>,
		eventType: string,
		key: string | null
	) {
		const eventKey = key ? `${eventType}:${key}` : eventType;
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

		selectCanvas.addEventListener('wheel', (e) => this._dispatchMouseEvent('wheel', e));
		window.addEventListener('beforeunload', (e) => this._dispatchCustomEvent('unload', e));

		selectCanvas.addEventListener('mousedown', (e) => this._dispatchMouseEvent('mousedown', e));
		window.addEventListener('mousemove', (e) => this._dispatchMouseEvent('mousemove', e));
		selectCanvas.addEventListener('mouseleave', (e) => this._dispatchMouseEvent('mouseleave', e));
		window.addEventListener('mouseup', (e) => this._dispatchMouseEvent('mouseup', e));
		selectCanvas.addEventListener('dblclick', (e) => this._dispatchMouseEvent('doubleclick', e));
		selectCanvas.addEventListener('contextmenu', (e) => this._dispatchMouseEvent('rightclick', e));
		selectCanvas.addEventListener('click', (e) => this._dispatchMouseEvent('leftclick', e));
	}

	private _dispatchCustomEvent(eventType: string, event: Event) {
		const handlers = this.customEventMap.get(eventType);
		if (!handlers || handlers.length === 0) return;

		for (const { handler } of handlers) {
			handler(event);
		}
	}

	private _dispatchKeyboardEvent(eventType: string, event: KeyboardEvent) {
		event.preventDefault();

		if (event.altKey) {
			return;
		}

		const vimKey = VimKeyMapper.normalizeKeyEvent(event);
		const handledKeys = new Set<string>();

		const exactHandlers = this.keyEventMap.get(`${eventType}:${vimKey}`) || [];
		const regexHandlers = [...this.keyEventMap.entries()]
			.filter(([key]) => {
				if (key.startsWith(`${eventType}:`)) {
					const pattern = key.replace(`${eventType}:`, '');
					try {
						return new RegExp(pattern).test(vimKey);
					} catch (err) {
						console.error(`Invalid regex: ${pattern}`, err);
						return false;
					}
				}
				return false;
			})
			.flatMap(([, value]) => value);

		const allHandlers = [...exactHandlers, ...regexHandlers];

		for (const { handler } of allHandlers) {
			if (!handledKeys.has(vimKey)) {
				const shouldSuppress = handler(event);
				handledKeys.add(vimKey);
				if (shouldSuppress === false) {
					event.preventDefault();
					event.stopPropagation();
					return;
				}
			}
		}
	}

	private _dispatchMouseEvent(eventType: string, event: MouseEvent) {
		if (
			eventType === 'mousemove' ||
			eventType === 'mouseup' ||
			eventType === 'mouseleave' ||
			eventType === 'wheel'
		) {
			this._dispatchEvent(this.mouseEventMap, eventType, event);
			return;
		}

		const button = event.button === 0 ? 'left' : event.button === 2 ? 'right' : null;
		if (!button) return;

		this._dispatchEvent(this.mouseEventMap, `${eventType}:${button}`, event);
	}

	private _dispatchEvent(
		eventMap: Map<string, { tool: BaseTool; handler: EventHandler }[]>,
		eventType: string,
		event: Event,
		key?: string
	) {
		const eventKey = key ? `${eventType}:${key}` : eventType;
		const handlers = eventMap.get(eventKey);
		if (!handlers || handlers.length === 0) return;

		for (const { handler } of handlers) {
			if (handler(event) === false) {
				event.preventDefault();
				return;
			}
		}
	}
}
