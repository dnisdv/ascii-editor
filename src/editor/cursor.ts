import type { ICanvas } from "./types";

const DEFAULT_CURSOR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAYCAYAAAAVibZIAAAABmJLR0QA/wD/AP+gvaeTAAADOUlEQVQ4jZ2VXWhbZRjHfycfHcEtcc7ivHCcWlZjmahk0aptWKcddpt1dL2Y+EEnQWVKkWJl7FbREaEiskJvld1JTS92U2FNoHjhTamJAWN17Zo1JGtJdlh70rwnOV7knPou62raBw7ni/f3PO///77Pq3BvKHXvJrsIlwRTAId1N4HqbuEO6dmZSqVezmQy51RV3Qs0WUkV6Wo4FGvw3tHR0S7TNM2NjY2FxcXFzwcHBw8CHsAtzaIhuA3dB7QKIVa//Ppy6s90+g8hxO1sNhuJRCKtO4Hb068CAlgvFouJqmlW3z0fbn/rnfeMv+b/Pj48PDyradoPU1NTzwJ7/k8WBzUTbGNELpdLdASDZYCbmVsHP7t4KXDqzNnK9Xi8pbu7+5e1tbXJ2dnZYxbcrtwhwx11SarJZHLumSNH9skfC4XCw19d/ibw2uun9vw08fMjfr//R13X4+l0eqC5udlTV/kmfdOszs7OtlgsNh169YTLMAz3Vpq5XO5q3+mT6Q/D73s8Ho+ezWYjLS0tVwEDqMqVmkBlZmamqOv6rafa2pa3dAEwDOGYiE76e/v6n0jPzzt8Pl+/JYcDUGSobZZWKBQSHS8Giw+C+nzetQsffZCauja5oh46VEkmk9eRdLWhtlkVQCwtLc0Fjwbq9ab9af/NK999m7gWnTCPdXUujI+PX/R6vedCodCkVZQpQ++RIB6Pzx1ubX1U/vGkqi6PX/neZ4hyvLe3t19V1UsjIyO/AnlgFSjJYDsUakvE19TU1C6E0E6cfOPOC6+EzJdC3UYul/snFotFgOcAP/A4sJ/7N8X9SwowyuXyuqZpqUDg+WWATz+5kHA6nas9PT1XgdtADigCd4ENLNftKl0SUNZVz+fzv3cEg0cXbiwun3mzTx0aGnpbCHHHApUkkD32gaFQ604HotHox5lMJr2ysrIwPT39hTXlA0hLZztQPdQN7B8YGOgyTbOaz+dngHbgMUs/506ANtQFeIHDmqYlw+HwcWqmPNQo0LkFdDNKpdJvY2NjS4BGzZAKDZwCW2VVrGQeaj1WB9ap7TbbzB1D4b925raqMxoFbge1v8v9dlcn606Sbhv/AuSlSFkdPKRzAAAAAElFTkSuQmCC'
const GRAB_CURSOR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAASCAYAAAC9+TVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAGdSURBVHgBrZO/SwJhGMe/nfbTX9VUi5M0V4sEhv9E1NISTQ0WBAVSQwgmtEVDS9QUWTm0RK2mS4s5GUgRhOkppaKeXed5l++rJ6X5q/rAcfc+73ufu+d5n7fLaDTKqEGlUtN7sSiiHdS1Ad3QMDRaPX3m83nIkgRB4CHwPGRZglQaN5V0d/dQwYXnlI4dThcmJ8ZxeXWNWIytE79zORrrUtLp6e1Dv0ZLr1u/l05mcznotFoE7oIYHR2hsTX7BsZMJgSCQTyEw8imk2XJgE4P/eAwrNMWeH3+quQnvoqXbCuIvzyDIROakmR12YYdlxOtIAICSVMpAUPSILsxNzuD38LUBpQv/Emyv7eLTmHwDzBypXlI1TtBWS8VJTCFgkC78ODwqBMHvDc+FEURoihAZTAYtsgZCT8+geM4TJnNbUnW7ZtgY1EUPvhyTfg8h9d4FMcnbswvLFZbvBHus3NEIhFwmTQdVwsrlX7tLcHiPhSCY9vVQuJBriL4JlFEmVSStnQzYixL66GgbrTQbLGiXeokZLdSCbbli2Sdwif6JrtzT9VqjgAAAABJRU5ErkJggg=='
const ROTATE_CURSOR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAdCAYAAABIWle8AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAP9SURBVHgBtVVfSFNhFP+2e1eb250Wla5WOFwFMqISfAlCqegfElH2UlL0UC8RFBghkhj076E/02KQVGB/Vr0JcyX1oCuliExD9uBMMceuIJrb7py6P1/nXO/Vu7llPfTB4e5+57u/75zf+Z0zQrIvFfnHpVZ+XFdXpy4rK2PhtwaMAWPxvbKykpHAVZTSv7pE3dbWtiaZTHbMzMw8i0Qi1yYnJ88EAoF9PM+XtrS05JeUlGgUwFlTwSdGpIWbQ3fsjYTjDMRkKiCmggLCGQxk08aNBHzDQ0NDe4qKin7A2WQ6GKuMzGg0ahKJhN/z8aOZ50fnHQcP7Ce1ly+FPB7PqaqqKn+2yJSckVAopI7H4yEDRCKv7du2kis1l0lzc/OJ8vJyr9/vz8qZEoxyHEej0ah3k9UqbmCq3d96SKv7LamoqDiJe2azmS4FhgdoOBxOQmRBA4Bgak+fPBJ5u3r9Bvn0+csR8NshMqwuIUtIB+WQCwTX9ft8FNPt7+93BnieHjp6jJbu2EldrW/o1NTU8/z8fD2Zk05WQHRyAHYeihB0OByH4d3m9Xod6YCCILwAX05WQNSPyWTK6ezs3OlyuXbD1jqw9WBFPp/vvhLwa/c3Chq8CT4dfpdJyMifRkqBk8wItlqr1RYODAw0IuCuvQdEC4XDFIS8BfzLFkUnoauJoo0kHjGdVWCW8fHx9w8fPRajwycUxIF+bEM5mhRMMqfsRHt7ewKeMbBZsCja8PDwO6wuLhQ1tN4KvLy+vl6VAqZSqagEpjQigSerq6v1NpvtXHd3j7hZsn0bAPKfSJYlTgQgdoV0iUoKX9PU1GSGlF46X70WUzx+6jSdnZ0dgYqXgl+fIUORRAbKvjsWi11FYgsLC7VOp3MtvH93tbpFIKwoFqKrq+ssdAxyqV0EJo2W5Th2IELU0vXa2lpLJiDQoh3OrgXDJmZJBq0hWM7ExMQt/DgQ4LELfqYDDQ4ONuh0OtQf0rGcZBmYeAMH5X94295ADx05RmWOZCDUGpzZkJubKwKlg6SM7by8PAZutWHZ+dFRcrfhvtjojkY7iQjCA6vVehvOCcFgEKUSkxSQGQz4UjMMYwS+FnYlkcA+1ev109By0wiEvKanlgKGxrLsep9vYH5TiAjiCLJYLOdGRkYugLZQdzQ9KpIGpIWxvRJvbPd8EAuA/YejCP5g/JBaG06L3t7ezVIQGUmXV6KmpsYAM+wiq1ZF79276+vr6xPcbvcv8MXBML2oZDIBiyJSAuME0JKFSYAfYI9iajEY2TEoQgz7Fin7U6oYOouqJ3OTAttEJ4MXFxfjBQzJ0DryYhS/kS4cesmOjo64lFpcjmxsbCxBUgfA/12/AfKyLd2i7hX4AAAAAElFTkSuQmCC'

export type CursorGeneratorConfig = {
  generator: (params?: any) => string | Promise<string>;
  hotspot?: [number, number];
};

export type CursorConfig = {
  dataUrl?: string;
  hotspot?: [number, number];
  generator?: (params?: any) => string | Promise<string>;
};

export class Cursor {
  private registry: Record<string, CursorConfig> = {};
  private canvas: HTMLElement;

  constructor({ canvas }: { canvas: ICanvas }) {
    this.canvas = canvas.canvas;
    this.initializeDefaultCursors();
    this.setCursor("default");
  }

  private initializeDefaultCursors(): void {
    this.registerCursor("default", { dataUrl: DEFAULT_CURSOR, hotspot: [0, 0] });
    this.registerCursor("grab", { dataUrl: GRAB_CURSOR, hotspot: [16, 16] });
    this.registerCursor("rotate", {
      generator: this.generateRotateCursor.bind(this),
      hotspot: [16, 16]
    });
  }

  public restore(): void {
    this.setCursor("default");
  }

  public registerCursor(name: string, config: CursorConfig): void {
    this.registry[name] = config;
  }

  public async setCursor(
    name: string,
    params?: any,
    customHotspot?: [number, number]
  ): Promise<void> {
    const config = this.registry[name];
    if (!config) {
      console.warn(`Cursor "${name}" is not registered.`);
      return;
    }
    const hotspot: [number, number] = customHotspot ?? config.hotspot ?? [0, 0];

    const dataUrl = config.generator
      ? await config.generator(params)
      : config.dataUrl;

    if (!dataUrl) {
      console.warn(
        `Cursor configuration for "${name}" has neither a dataUrl nor a generator.`
      );
      return;
    }

    this.updateCursor(dataUrl, hotspot);
  }

  private updateCursor(dataUrl: string, hotspot: [number, number]): void {
    this.canvas.style.cursor = `url(${dataUrl}) ${hotspot[0]} ${hotspot[1]}, auto`;
  }

  private generateRotateCursor(params?: { angle: number }): Promise<string> {
    return new Promise((resolve) => {
      const angle = params?.angle ?? 0;
      const image = new Image();
      image.src = ROTATE_CURSOR;
      image.onload = () => {
        const imgWidth = image.width;
        const imgHeight = image.height;
        const diagonal = Math.sqrt(imgWidth ** 2 + imgHeight ** 2);
        const canvas = document.createElement("canvas");
        canvas.width = diagonal;
        canvas.height = diagonal;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.translate(diagonal / 2, diagonal / 2);
          ctx.rotate((angle * Math.PI) / 180);
          ctx.drawImage(image, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
        }
        resolve(canvas.toDataURL("image/png"));
      };
    });
  }
}

