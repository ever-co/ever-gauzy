import { ICommand } from '@nestjs/cqrs';

export class GlobalSettingGetCommand implements ICommand {
	static readonly type = '[Global] Setting Get';

	constructor(public readonly names?: string[]) {}
}
