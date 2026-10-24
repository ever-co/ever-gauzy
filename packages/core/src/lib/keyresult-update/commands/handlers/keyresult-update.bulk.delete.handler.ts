import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { KeyResultUpdateBulkDeleteCommand } from '..';
import { KeyResultUpdateService } from '../../keyresult-update.service';

@CommandHandler(KeyResultUpdateBulkDeleteCommand)
export class KeyResultUpdateBulKDeleteHandler implements ICommandHandler<KeyResultUpdateBulkDeleteCommand> {
	constructor(private readonly keyResultUpdateService: KeyResultUpdateService) {}

	public async execute(command: KeyResultUpdateBulkDeleteCommand): Promise<any> {
		const { id } = command;
		// The caller's own updates of the key result, or all of them for a tenant administrator
		await this.keyResultUpdateService.deleteByKeyResultId(id);
		return;
	}
}
