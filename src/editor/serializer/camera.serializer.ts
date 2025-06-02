import type { ICamera } from '@editor/types';
import type { CameraSerializableSchemaType } from './';

export class CameraSerializer {
	constructor(private camera: ICamera) {}

	serialize(): CameraSerializableSchemaType {
		const { offsetY, offsetX, scale } = this.camera.getState();
		return {
			offsetX,
			offsetY,
			scale
		};
	}

	deserialize(): void {}
}
