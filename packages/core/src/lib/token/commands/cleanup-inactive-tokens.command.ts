import { ICommand } from '@nestjs/cqrs';

export class CleanupInactiveTokensCommand implements ICommand {
	constructor(public readonly tokenType: string, public readonly threshold: number) {}
}
