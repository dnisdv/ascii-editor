import type { Config } from '@editor/config';
import type { ConfigSerializableSchemaType } from './';

export class ConfigSerializer {
	constructor(private config: Config) {}

	serialize(): ConfigSerializableSchemaType {
		return {
			tileSize: this.config.tileSize
		};
	}

	deserialize(configData: ConfigSerializableSchemaType): void {
		this.config.setTileSize(configData.tileSize);
	}
}
