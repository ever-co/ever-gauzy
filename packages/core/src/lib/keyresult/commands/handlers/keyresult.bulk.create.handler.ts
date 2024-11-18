import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { KeyResultBulkCreateCommand } from '../keyresult.bulk.create.command';
import { IKeyResult } from '@gauzy/contracts';
import { KeyResultService } from '../../keyresult.service';

@CommandHandler(KeyResultBulkCreateCommand)
export class KeyResultBulkCreateHandler
	implements ICommandHandler<KeyResultBulkCreateCommand> {
	constructor(private readonly keyResultService: KeyResultService) {}

	public async execute(
		command: KeyResultBulkCreateCommand
	): Promise<IKeyResult[]> {
		const { input } = command;
		const createdKeyResults = await this.keyResultService.createBulk(input);
		return createdKeyResults;
	}
}
