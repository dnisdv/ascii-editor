import { EventEmitter } from './event-emitter';
import type { MetaData } from './types';
import type { IToolModel, IToolOptions } from './types/external/tool';

type ToolEventMap = {
	'tool::register::response': IToolModel;

	'tool::activate::request': Pick<IToolModel, 'name'>;
	'tool::activate::response': Pick<IToolModel, 'name'>;

	'tool::deactivate::request': never;
	'tool::deactivate::response': Pick<IToolModel, 'name'>;

	'tool::deactivate_all::request': never;
	'tool::deactivate_all::response': never;

	'tool::update_config::request': { name: string; config: IToolOptions };
	'tool::update_config::response': { name: string; config: IToolOptions };
} & {
	[x in string]: unknown;
};

type ToolEventSuffix<ToolName extends string> = {
	[K in keyof ToolEventMap]: K extends `tool::${ToolName}::${infer E}` ? E : string;
}[keyof ToolEventMap];

type FullToolEvent<ToolName extends string, E extends string> = `tool::${ToolName}::${E}`;

export class BaseBusTools extends EventEmitter<ToolEventMap> {
	withTool<ToolName extends string>(toolName: ToolName) {
		return {
			emit: <E extends ToolEventSuffix<ToolName>>(
				event: E,
				data?: ToolEventMap[FullToolEvent<ToolName, E>],
				meta?: MetaData
			) => {
				const fullEvent: FullToolEvent<ToolName, E> = `tool::${toolName}::${event}`;
				if (meta) {
					this.emit(fullEvent, data, meta);
				} else {
					this.emit(fullEvent, data);
				}
			},
			on: <E extends ToolEventSuffix<ToolName>>(
				event: E,
				// TODO:
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				cb: (data: ToolEventMap[FullToolEvent<ToolName, E>] | any, meta?: MetaData) => void
			) => {
				const fullEvent: FullToolEvent<ToolName, E> = `tool::${toolName}::${event}`;
				return this.on(fullEvent, cb);
			}
		};
	}
}
