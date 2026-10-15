import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { KeyResultUpdateBulkDeleteCommand } from '..';
import { KeyResultUpdateService } from '../../keyresult-update.service';

@CommandHandler(KeyResultUpdateBulkDeleteCommand)
export class KeyResultUpdateBulKDeleteHandler implements ICommandHandler<KeyResultUpdateBulkDeleteCommand> {
	constructor(private readonly keyResultUpdateService: KeyResultUpdateService) {}

	/**
	 * Removes every update of one key result.
	 *
	 * @returns The delete result, so a caller can tell updates that were removed from a key result that had
	 * none (`affected: 0`) — the GraphQL field answers from it.
	 */
	public async execute(command: KeyResultUpdateBulkDeleteCommand): Promise<DeleteResult> {
		const { id } = command;
		const updates = await this.keyResultUpdateService.findByKeyResultId(id);

		return await this.keyResultUpdateService.deleteMany(updates.map((item) => item.id));
	}
}
