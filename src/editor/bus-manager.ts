import type { BaseBusNotification } from './bus-notification';
import type { BaseBusLayers } from './bus-layers';
import type { BaseBusTools } from './bus-tools';

type ConstructorParams = {
	layers: BaseBusLayers;
	tools: BaseBusTools;
	notifications: BaseBusNotification;
};

export class BusManager {
	layers: BaseBusLayers;
	tools: BaseBusTools;
	notifications: BaseBusNotification;

	constructor({ layers, tools, notifications: errors }: ConstructorParams) {
		this.layers = layers;
		this.tools = tools;
		this.notifications = errors;
	}
}
