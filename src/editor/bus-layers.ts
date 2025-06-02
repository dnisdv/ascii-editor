import { EventEmitter } from './event-emitter';
import type { DeepPartial, ILayerModel, ITileModel } from './types';
import type { RequireAtLeastOne } from './types';

type EventMap = {
	'layers::update::response': RequireAtLeastOne<ILayerModel, 'id'>[];

	'layers::create::response': ILayerModel[];

	'layer::create::request': never;
	'layer::create::response': ILayerModel;

	'layer::update::request': Pick<ILayerModel, 'id'> & DeepPartial<Omit<ILayerModel, 'id'>>;
	'layer::update::response': RequireAtLeastOne<ILayerModel, 'id'>;

	'layer::remove::request': Pick<ILayerModel, 'id'>;
	'layer::remove::response': Pick<ILayerModel, 'id'>;

	'layer::change_active::request': Pick<ILayerModel, 'id'>;
	'layer::change_active::response': Pick<ILayerModel, 'id'> | { id: null };

	'layer::tile::change': ITileModel & { layerId: string };
	'layer::tile::removed': { x: number; y: number; layerId: string };

	'hydratate::layers::create': ILayerModel[];
	'hydratate::layer::activate': string | null;
};

export class BaseBusLayers extends EventEmitter<EventMap> {}
