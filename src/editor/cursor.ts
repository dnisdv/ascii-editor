import type { ICanvas } from './types';

const DEFAULT_CURSOR =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAYCAYAAAAVibZIAAAABmJLR0QA/wD/AP+gvaeTAAADOUlEQVQ4jZ2VXWhbZRjHfycfHcEtcc7ivHCcWlZjmahk0aptWKcddpt1dL2Y+EEnQWVKkWJl7FbREaEiskJvld1JTS92U2FNoHjhTamJAWN17Zo1JGtJdlh70rwnOV7knPou62raBw7ni/f3PO///77Pq3BvKHXvJrsIlwRTAId1N4HqbuEO6dmZSqVezmQy51RV3Qs0WUkV6Wo4FGvw3tHR0S7TNM2NjY2FxcXFzwcHBw8CHsAtzaIhuA3dB7QKIVa//Ppy6s90+g8hxO1sNhuJRCKtO4Hb068CAlgvFouJqmlW3z0fbn/rnfeMv+b/Pj48PDyradoPU1NTzwJ7/k8WBzUTbGNELpdLdASDZYCbmVsHP7t4KXDqzNnK9Xi8pbu7+5e1tbXJ2dnZYxbcrtwhwx11SarJZHLumSNH9skfC4XCw19d/ibw2uun9vw08fMjfr//R13X4+l0eqC5udlTV/kmfdOszs7OtlgsNh169YTLMAz3Vpq5XO5q3+mT6Q/D73s8Ho+ezWYjLS0tVwEDqMqVmkBlZmamqOv6rafa2pa3dAEwDOGYiE76e/v6n0jPzzt8Pl+/JYcDUGSobZZWKBQSHS8Giw+C+nzetQsffZCauja5oh46VEkmk9eRdLWhtlkVQCwtLc0Fjwbq9ab9af/NK999m7gWnTCPdXUujI+PX/R6vedCodCkVZQpQ++RIB6Pzx1ubX1U/vGkqi6PX/neZ4hyvLe3t19V1UsjIyO/AnlgFSjJYDsUakvE19TU1C6E0E6cfOPOC6+EzJdC3UYul/snFotFgOcAP/A4sJ/7N8X9SwowyuXyuqZpqUDg+WWATz+5kHA6nas9PT1XgdtADigCd4ENLNftKl0SUNZVz+fzv3cEg0cXbiwun3mzTx0aGnpbCHHHApUkkD32gaFQ604HotHox5lMJr2ysrIwPT39hTXlA0hLZztQPdQN7B8YGOgyTbOaz+dngHbgMUs/506ANtQFeIHDmqYlw+HwcWqmPNQo0LkFdDNKpdJvY2NjS4BGzZAKDZwCW2VVrGQeaj1WB9ap7TbbzB1D4b925raqMxoFbge1v8v9dlcn606Sbhv/AuSlSFkdPKRzAAAAAElFTkSuQmCC';
const GRAB_CURSOR =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAASCAYAAAC9+TVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAGdSURBVHgBrZO/SwJhGMe/nfbTX9VUi5M0V4sEhv9E1NISTQ0WBAVSQwgmtEVDS9QUWTm0RK2mS4s5GUgRhOkppaKeXed5l++rJ6X5q/rAcfc+73ufu+d5n7fLaDTKqEGlUtN7sSiiHdS1Ad3QMDRaPX3m83nIkgRB4CHwPGRZglQaN5V0d/dQwYXnlI4dThcmJ8ZxeXWNWIytE79zORrrUtLp6e1Dv0ZLr1u/l05mcznotFoE7oIYHR2hsTX7BsZMJgSCQTyEw8imk2XJgE4P/eAwrNMWeH3+quQnvoqXbCuIvzyDIROakmR12YYdlxOtIAICSVMpAUPSILsxNzuD38LUBpQv/Emyv7eLTmHwDzBypXlI1TtBWS8VJTCFgkC78ODwqBMHvDc+FEURoihAZTAYtsgZCT8+geM4TJnNbUnW7ZtgY1EUPvhyTfg8h9d4FMcnbswvLFZbvBHus3NEIhFwmTQdVwsrlX7tLcHiPhSCY9vVQuJBriL4JlFEmVSStnQzYixL66GgbrTQbLGiXeokZLdSCbbli2Sdwif6JrtzT9VqjgAAAABJRU5ErkJggg==';
const ROTATE_CURSOR =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAdCAYAAABIWle8AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAP9SURBVHgBtVVfSFNhFP+2e1eb250Wla5WOFwFMqISfAlCqegfElH2UlL0UC8RFBghkhj076E/02KQVGB/Vr0JcyX1oCuliExD9uBMMceuIJrb7py6P1/nXO/Vu7llPfTB4e5+57u/75zf+Z0zQrIvFfnHpVZ+XFdXpy4rK2PhtwaMAWPxvbKykpHAVZTSv7pE3dbWtiaZTHbMzMw8i0Qi1yYnJ88EAoF9PM+XtrS05JeUlGgUwFlTwSdGpIWbQ3fsjYTjDMRkKiCmggLCGQxk08aNBHzDQ0NDe4qKin7A2WQ6GKuMzGg0ahKJhN/z8aOZ50fnHQcP7Ce1ly+FPB7PqaqqKn+2yJSckVAopI7H4yEDRCKv7du2kis1l0lzc/OJ8vJyr9/vz8qZEoxyHEej0ah3k9UqbmCq3d96SKv7LamoqDiJe2azmS4FhgdoOBxOQmRBA4Bgak+fPBJ5u3r9Bvn0+csR8NshMqwuIUtIB+WQCwTX9ft8FNPt7+93BnieHjp6jJbu2EldrW/o1NTU8/z8fD2Zk05WQHRyAHYeihB0OByH4d3m9Xod6YCCILwAX05WQNSPyWTK6ezs3OlyuXbD1jqw9WBFPp/vvhLwa/c3Chq8CT4dfpdJyMifRkqBk8wItlqr1RYODAw0IuCuvQdEC4XDFIS8BfzLFkUnoauJoo0kHjGdVWCW8fHx9w8fPRajwycUxIF+bEM5mhRMMqfsRHt7ewKeMbBZsCja8PDwO6wuLhQ1tN4KvLy+vl6VAqZSqagEpjQigSerq6v1NpvtXHd3j7hZsn0bAPKfSJYlTgQgdoV0iUoKX9PU1GSGlF46X70WUzx+6jSdnZ0dgYqXgl+fIUORRAbKvjsWi11FYgsLC7VOp3MtvH93tbpFIKwoFqKrq+ssdAxyqV0EJo2W5Th2IELU0vXa2lpLJiDQoh3OrgXDJmZJBq0hWM7ExMQt/DgQ4LELfqYDDQ4ONuh0OtQf0rGcZBmYeAMH5X94295ADx05RmWOZCDUGpzZkJubKwKlg6SM7by8PAZutWHZ+dFRcrfhvtjojkY7iQjCA6vVehvOCcFgEKUSkxSQGQz4UjMMYwS+FnYlkcA+1ev109By0wiEvKanlgKGxrLsep9vYH5TiAjiCLJYLOdGRkYugLZQdzQ9KpIGpIWxvRJvbPd8EAuA/YejCP5g/JBaG06L3t7ezVIQGUmXV6KmpsYAM+wiq1ZF79276+vr6xPcbvcv8MXBML2oZDIBiyJSAuME0JKFSYAfYI9iajEY2TEoQgz7Fin7U6oYOouqJ3OTAttEJ4MXFxfjBQzJ0DryYhS/kS4cesmOjo64lFpcjmxsbCxBUgfA/12/AfKyLd2i7hX4AAAAAElFTkSuQmCC';

const RESIZE_NS =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAeCAYAAAAsEj5rAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAANNSURBVHgB1VVfSFNRGD9zu9tyc5O53NzEhu5lViAI9VDM18y3wIemkK2IXioWBD1EYvUQhEr1IFHqgkrqoRBcJj0FAwnxOZ/MxdwWgeTc5v7e2++7Xtf+4vSpPvhxzj3nO7/zne/fZex/F1l/f7+cgLl8eHi4ThAEdmAhAgyqVCp1n4C5EqhjBxSRbH19/XwoFBYIa2trvZ2dnQcipQNKn893PJvN/hi44BYGhtwCz/O/FxYWjkmWympigo9IkfN6vdZcLhcYffxEOHHKKWIMc7pgYmLCCh1FLaSkQAHQxGKxNzNv3+XJdkFriUTiNXTqJV1ZKUHhnKCKRqN3I5GftwcvXqp466vpSWY2mx7qdLp7+EwBfDVCLhKJnDOZTDNzH+dZOBIRN15MecXxsntIHC1mM+s728tWV1f7Ojo6PmMpS94qIqRcW1pa4hYXF93woz0ejyvT6TSHqF45ebpH1Pnq/8JWVlaecRyXUavVhF9Op3MUZ7MjIyN86UvEyBoMBh1GE3AEcIA87z8SpVJ5FOs2SYd0uQJ3/c0nYacE+I2NjTTGeENDQxxjovRWWE3ruxD9J1WPUEQok8lEQiBDiltbW9vSgTJOYLu7uzsl+Y6XzoqiKFHe9QMp5CSUiri+vLycK9DPS7USEm/UarVlGxqNhrW2tuZ19iKUSQ2BLFeg1BRlNwmCPBgM1uHJCqkLVU5sKjmIPJlM3kDJGTKZjBzVorRarZ7CtEGzGIflaZVKlcWF32HxS8kNosV5C4gNgxwHvrW3t/vm5j+xcDhcZN3zqWkaPJaWFtbXe4aFQiEXvRKv4pGHxYktPZ+6SD2edCeR2PZULT3vJNNqNGMOh+PB5uYmpVZWsrLIh4LdbhejC6ePNzbqP3iuXysju4m1Rr3+vcViGQcZRZnykGdVRA6yQxibXC5XF7p0sLh9PRVoDcHoQuI32Ww2daXAFAptkF81cHwz/NKD/hel5kogMlrDfjOr0r7KhKKNlOCMRmMDPi2zs7ODoTB+AYDf77+KtRaA9jipGZdZVM1SKnp6vjYQCNyi8mpra3uE7xiQZDsluq9fIAVMDeiBw4CROhECp6ILK1lXKymlkloK1p5/vFpukRXoCWyfz/z35A/QAoLj9xlUAgAAAABJRU5ErkJggg==';
const RESIZE_EW =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAYAAACaq43EAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAK5SURBVHgB7VU9bFJRFL7Ae4VSXl+orQ3IoJUudNBI4mJi0DjJRiTRuYOLm3FACdTBLqYkti424lprlyZiO7gQQhiZgIG/xECfjITfEH6u5+B9QEsLRDbTLzm5993z89177jn3EXKJYSgopQoYlTiCnFKyNdSrvF6vEu3Qh0wDRqIC4YvF4qNarfaSfQ8GxjlXr9fXy+XyE7Q9x2YIyhE6BQADzFQqlbeiKP6EjSxYLJazQTGGqtls3tTpdAfVanUDfciYkytHrHN+v38ZTumXpN+uwNExaTQaXCKR6AXFFFutVpzPADH3A2xOTqTX4PMZfW0229iT98DuSR0Oh9fa7favvf1v9O69+3TX/4VKkrQlCMIi6HUgGrQDmYO1K/l83oc2aIs+6BsKhSyg5zEmq4MLgTtUZzKZx51Op7j1YbsbSCYeB5kYxQe+SF4oFJ6yDZ5K/dm74uA+N0qlsuuV6w1JpdNkGqyumsn7zXdEFOc37Xa7NxgMtmGZymSDwOrkutuZriH6gDgYE0g5cl5Up9OpMhgMWphejUQiz6GQ8tOleoe2Wq1SIBB4BjEXTSbTLLmgmLvVqdfrRRivud3uh0i+t3/QI47H4594nr8N+jUmFjbeisViuzLxV/BBX4/H8wB0RhCB/O3v4ROzx6Jb0SCiVqs1OhyOO1Ach8lkin4/OqbZbHYHdNdZsGUmRo1GcwMK8iO0HE2mUlj9h+gLOgPGIv2+HgklM5xngVeAcBtTCQF98L0EomOpw5bC1lpCHdqk02nc3ArzFSYllaFgqcE7x741RaPR9Vwu94IR8aTfHjgXoI/dUEBOtGW9PgcPCDcQb3JgwcEwi/cO0CMBPJkzbH0wQ2pWGwtsxGyoyL8CXxt8dZAMPjVms1nNTjH0k0Bylv7uxsa9VJNCMeaXJ3f+9L/E/xZ/ADHgi7mdt3TDAAAAAElFTkSuQmCC';
const RESIZE_NW_SE =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAM8SURBVHgBtVRdSFNhGP7O/Nnaj0u3tR11Jm7hzLzSCiy86UIYiBdpN92MAmsXNryQsoIhJYkEMgx2FXhXYF5k/tCdTEIEK6lYopt/wTYR3H+W287pfbczOVvTKdELD+93vu87z/t+7/t8HyH/ySj+uLOzU4CDsbExnGcRVqs1udjf389ycycOULi3t3cb8DQQCNzZ3t5uXV9fvzw+Pk5XV1eLYL24sbGxCAJhcMFxCNEKkDgUCllXXe4+j89LaI2GyKRS8DSRSiXBRCKxVVBQ4N/f358QiUTDsJ85iriQPw4Gg14kfTIwmLEJAsiHng00NFyo//YajEvkyNLwjyTw+/0RKWSZbT33ukn9+TqnxWLpMJlMIXKMWvOJ2fn5eWet/lzGBprWkJaWq8Ttdr+12+0htVrNnIQYNzJLS0sBqUyaQer1+oi520K0VVV9a2trHdBUAurhc1AkU10ke/EUQA1NCl5rNbKTUzNsKBxmb5pusZeutCQ9fgPxXb1eLySp/hQuLi4q4Z8ekqo7lYsYJaWKx+M/Zh1zbCQSWYafnh9GDnslUJqKWCz2BTAB3xhMwLJZVcIsSkpKysLh8HvQsrOtre0iTNcuLCw8zEXu8Xgeg/S+zjocLGS8CXtl3Cmo7IyLcNHn8z3q6uoywFjD4Sxk/iAX+eTUNItlYxgmAPvKuKwzy8HdKFzA7kmh+xI8LqAUUJlN3n79RtIjcL63t1fH3VCKr4q0xQG/EVDHX+ARPwHRpqamV1ubm4P2EVvyVnp9voOfIuEIMRgMpRsbG9RfxPDIoD4ZKH6cC8BwSABiZrNZpNPp2h2OuQxStBWXizQ3N9fzy5CdMUtRVPqqsukOj46Oym022xvn9+W64ZEXJNvCkTCB90OOfKDxQzV9YFh3fNF2d3fvg1I+oFpAjiGs6crKKvvx02f23fRM0u/s7AypVCrsD+qZ5GNPPqcAoQQsGo0mn0+Q4mmj0VipUCjkWq22HAwvlqumpuYlSfUokTdrOBpmIFQqlTIwBTxSZ8RiMQ1z5YBKQAXEVIPHUgg5dR3POHLUOcpRRNO0GLyYkyQeH30xSd28/DXOYWk5CfjgAgtI/tL+u/0BT1iWgejpVzUAAAAASUVORK5CYII=';
const RESIZE_NE_SW =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAANASURBVHgBvVVfSFNRGD/b3eb+6optbGnmn63wRRDLHiqTeggC8SHni2DhUwNdNRLCgmEvohCaPgg+9W7SQ5vhU2WFzFaR1TIT0srNIRLb7tK23d2+b96Ld/PqrAc/+HHu2fnO73x/fueMkP83CYcdF/+JjGVZIgHDid1uz4xjY2M4skLkJXa73VIce3p6pFarlUqlUpL+/n59RUWFvry8vFoul+sBpeDyra2t7QEcks5LzEVHbWxsXJfJZGcpiqqG3/Q0HS+i6RiZX1ggMZomh8wWYrNW9hYWFt6FbQlAOl/AeLB8aGioJJFIfHj2/AV7/sJFtu5UfRYeT0ywS0tLneCrhvJQuFFK9mBOpzPa0dFhP1l3/PMNZ+e2dYw4GAwuE0HP8hHzzWBGR0cji4uLj+rPnCYWsznLSafVkrW1tSgSQ41FicUkhMQEUm0uLi7pdnReI6GVFWKxbJGb4dvr9f4QBLKNlEomky6/32/gakWBEgrC4bAjGo2xrZfbMzVtvdLORmMx1uN9kqk5wzAR5Acoc4PNkAIKQE5T4Ph+ZGSkGObq1dXVq2KkPp/vHk3Tc2/evmNBNZ/A14jEoJrsjGtra+UGg0GH3UdnHKEhd8RIp6enu2FLVWNj44n19fUA4BXMDwIUJKeUOCnARUwL08M0xUhnZmZugd9hLnWzw+E4BgHcxh4CZNuIy8rKlF1dXZW4mddn06UWMdISwAGAhoPOaDRqMTBew1tth7pYLBb15OTkuS/zX7PE39TckiGdnZ3tBdcjHClPgpBzkVIkV8dwbaWhUIjo9fqiGFxVoYVCK2Rq6iWx2WxNLpcLy/UHkOLeBAaQxDn3zQqJJXB65ttkMpWiRnNtYHiY+F77q/r6+h6Oj48XNTQ0SIiIXnObRrhUlKBX98/l4M0gkONtOmq1Eq1OS9QqVSydTkdAKR9Bjk8hswEoXwoy3ZFcxpcZGkBAj99NRsN9JpUMRyIRenBwYC4QCEQ8Hs8vpVKZgPXf4ItgdyMVRowlwSaoyObt4RuR1mg0TDweT8OTyCgUiiREm6ipqeFrvCs5b5mbB1ADtBxQTiqUItkUP2Yo5R//PRu3gZeRVAAJyfMft2/2FxxdqQlbnMCKAAAAAElFTkSuQmCC';

export enum CursorTypes {
	DEFAULT,
	GRAB,
	ROTATE,
	RESIZE_NS,
	RESIZE_EW,
	RESIZE_NW_SE,
	RESIZE_NE_SW
}

export type CursorTypesGeneratorParams = {
	[CursorTypes.DEFAULT]: undefined;
	[CursorTypes.GRAB]: undefined;
	[CursorTypes.ROTATE]: { angle?: number };
};

export type CursorGeneratorConfig = {
	generator: (params?: unknown) => string | Promise<string>;
	hotspot?: [number, number];
};

export type CursorConfig = {
	dataUrl?: string;
	hotspot?: [number, number];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	generator?: (params?: any) => string | Promise<string>;
};

export class Cursor {
	private registry: Record<string, CursorConfig> = {};
	private canvas: HTMLElement;
	private latestSetCallId = 0;

	constructor({ canvas }: { canvas: ICanvas }) {
		this.canvas = canvas.canvas;
		this.initializeDefaultCursors();
		this.setCursor('default');
	}

	private initializeDefaultCursors(): void {
		this.registerCursor('default', { dataUrl: DEFAULT_CURSOR, hotspot: [5, 3] });
		this.registerCursor('grab', { dataUrl: GRAB_CURSOR, hotspot: [8, 8] });
		this.registerCursor('rotate', {
			generator: this.generateRotateCursor.bind(this),
			hotspot: [9, 9]
		});
		this.registerCursor('resize-ns', { dataUrl: RESIZE_NS, hotspot: [10, 15] });
		this.registerCursor('resize-ew', { dataUrl: RESIZE_EW, hotspot: [15, 9] });
		this.registerCursor('resize-nwse', { dataUrl: RESIZE_NW_SE, hotspot: [11, 10] });
		this.registerCursor('resize-nesw', { dataUrl: RESIZE_NE_SW, hotspot: [11, 10] });
	}

	public restore(): void {
		this.setCursor('default');
	}

	public registerCursor(name: string, config: CursorConfig): void {
		this.registry[name] = config;
	}

	public async setCursor(
		name: string,
		params?: unknown,
		customHotspot?: [number, number]
	): Promise<void> {
		const callId = ++this.latestSetCallId;

		const config = this.registry[name];
		if (!config) {
			console.warn(`Cursor "${name}" is not registered.`);
			return;
		}
		const hotspot: [number, number] = customHotspot ?? config.hotspot ?? [0, 0];
		const dataUrl = config.generator ? await config.generator(params) : config.dataUrl;
		if (callId !== this.latestSetCallId) return;

		if (!dataUrl) {
			console.warn(`Cursor configuration for "${name}" has neither a dataUrl nor a generator.`);
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
				const canvas = document.createElement('canvas');
				canvas.width = diagonal;
				canvas.height = diagonal;
				const ctx = canvas.getContext('2d');
				if (ctx) {
					ctx.translate(diagonal / 2, diagonal / 2);
					ctx.rotate((angle * Math.PI) / 180);
					ctx.drawImage(image, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
				}
				resolve(canvas.toDataURL('image/png'));
			};
		});
	}
}
