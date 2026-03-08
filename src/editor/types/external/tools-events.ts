import type { IToolModel } from './tool';

export type ToolEventMap = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	'config::changed': Record<any, any>;
};

export type ToolsEventMap = {
	'tool::activated': Pick<IToolModel, 'name'>;
	'tool::registered': Pick<IToolModel, 'name'> & { config: Record<string, unknown> };
};

export type ProxiedToolEvents = {
	[K in keyof ToolEventMap as `tool::${string & K}`]: { name: string; config: ToolEventMap[K] };
};
export type ToolsManagerEvents = ToolsEventMap & ProxiedToolEvents;
