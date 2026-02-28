export abstract class MenuCommand {
	abstract execute(): void | Promise<void>;
}
