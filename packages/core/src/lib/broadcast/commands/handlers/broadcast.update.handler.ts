import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { IBroadcast } from '@gauzy/contracts';
import { BroadcastUpdateCommand } from '../broadcast.update.command';
import { BroadcastService } from '../../broadcast.service';

@CommandHandler(BroadcastUpdateCommand)
export class BroadcastUpdateHandler implements ICommandHandler<BroadcastUpdateCommand> {
	constructor(private readonly broadcastService: BroadcastService) {}

	public async execute(command: BroadcastUpdateCommand): Promise<IBroadcast | UpdateResult> {
		const { id, input } = command;
		return await this.broadcastService.update(id, input);
	}
}
