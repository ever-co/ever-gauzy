import { ICommand } from '@nestjs/cqrs';

export class PluginConfigGetCommand implements ICommand {
	public static readonly type = '[Plugin] Config Get';

	constructor(public readonly input: any) {}
}
