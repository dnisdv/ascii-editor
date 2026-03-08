export type CommandHandler = (args?: unknown) => void;

export class EditorCommands {
	private registry = new Map<string, CommandHandler>();

	register(id: string, handler: CommandHandler): void {
		this.registry.set(id, handler);
	}

	unregister(id: string): void {
		this.registry.delete(id);
	}

	has(id: string): boolean {
		return this.registry.has(id);
	}

	execute(id: string, args?: unknown): void {
		const fn = this.registry.get(id);
		if (!fn) return;
		fn(args);
	}
}

export { EditorCommands as CommandRegistry };
