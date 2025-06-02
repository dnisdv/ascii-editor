import type { BusManager } from '@editor/bus-manager';
import type { CoreApi } from '@editor/core';

export type IToolOptions = {
	[x: string]: unknown;
};

export interface ToolRequirements {
	layer?: {
		visible?: boolean;
		locked?: boolean;
		exists?: boolean;
	};
}

export type IToolConfig = {
	name: string;
	isVisible: boolean;

	hotkey?: string | null;
	config: IToolOptions;
	bus: BusManager;
	requirements?: ToolRequirements;
	coreApi: CoreApi;
};

export type IToolModel = {
	name: string;
	isVisible: boolean;
	config?: IToolOptions;
};
