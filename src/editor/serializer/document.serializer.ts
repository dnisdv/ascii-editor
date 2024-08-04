import type { App } from "@editor/app";
import { LayersSerializer } from "./layers.serializer";
import { CameraSerializer } from "./camera.serializer";
import { DocumentSchema, type DocumentSchemaType } from "./document.serializer.schema";
import { ConfigSerializer } from "./config.serializer";
import { ToolsConfigSerializer } from "./tools.serializer";

export class AppSerializer {
  private layersSerializer: LayersSerializer;
  private cameraSerializer: CameraSerializer;
  private configSerializer: ConfigSerializer;
  private toolsConfigSerializer: ToolsConfigSerializer

  constructor(private app: App) {
    this.layersSerializer = new LayersSerializer(this.app.getLayersManager(), this.app);
    this.cameraSerializer = new CameraSerializer(this.app.getCamera());
    this.configSerializer = new ConfigSerializer(this.app.getConfig())
    this.toolsConfigSerializer = new ToolsConfigSerializer(this.app.getToolManager())
  }

  serialize(): DocumentSchemaType {
    return {
      meta: {
        title: "DEFAULT DOCUMENT",
        version: "1.0",
      },
      config: {
        tileSize: 25,
      },
      tools: this.toolsConfigSerializer.serialize(),
      layers: this.layersSerializer.serialize(),
      camera: this.cameraSerializer.serialize(),
      history: null,
    };
  }

  deserialize(data: DocumentSchemaType): void {
    const validationResult = DocumentSchema.safeParse(data);

    if (!validationResult.success) {
      console.error("Deserialization failed:", validationResult.error);
      throw new Error("Invalid document schema");
    }
    const validData = validationResult.data;


    this.layersSerializer.deserialize(validData.layers);
    this.configSerializer.deserialize(validData.config);
    this.toolsConfigSerializer.deserialize(validData.tools)

    this.app.render();
  }
}

