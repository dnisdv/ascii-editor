import type { Config } from '@editor/config';
import type { ConfigSerializableSchemaType } from './';

export class ConfigSerializer {
	constructor(private config: Config) {}

	serialize(config: Config): ConfigSerializableSchemaType {
		return {
			tileSize: config.tileSize
		};
	}

	deserialize(configData: ConfigSerializableSchemaType): void {
		this.config.setTileSize(configData.tileSize);
	}
}
