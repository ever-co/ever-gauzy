import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IBroadcast } from '@gauzy/contracts';
import { BroadcastCreateCommand } from '../broadcast.create.command';
import { BroadcastService } from '../../broadcast.service';

@CommandHandler(BroadcastCreateCommand)
export class BroadcastCreateHandler implements ICommandHandler<BroadcastCreateCommand> {
	constructor(private readonly broadcastService: BroadcastService) {}

	public async execute(command: BroadcastCreateCommand): Promise<IBroadcast> {
		const { input } = command;
		return await this.broadcastService.create(input);
	}
}
