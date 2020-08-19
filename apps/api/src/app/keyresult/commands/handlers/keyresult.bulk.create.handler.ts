import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { KeyResultBulkCreateCommand } from '../keyresult.bulk.create.command';
import { KeyResult } from '@gauzy/models';
import { KeyResultService } from '../../keyresult.service';

@CommandHandler(KeyResultBulkCreateCommand)
export class KeyResultBulkCreateHandler
	implements ICommandHandler<KeyResultBulkCreateCommand> {
	constructor(private readonly keyResultService: KeyResultService) {}

	public async execute(
		command: KeyResultBulkCreateCommand
	): Promise<KeyResult[]> {
		const { input } = command;
		const createdKeyResults = await this.keyResultService.createBulk(input);
		return createdKeyResults;
	}
}
