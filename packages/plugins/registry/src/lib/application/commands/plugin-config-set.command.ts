import { ICommand } from '@nestjs/cqrs';

export class PluginConfigSetCommand implements ICommand {
	public static readonly type = '[Plugin] Config Set';

	constructor(public readonly input: any) {}
}
