import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { KeyResultUpdateBulkDeleteCommand } from '..';
import { KeyResultUpdateService } from '../../keyresult-update.service';

@CommandHandler(KeyResultUpdateBulkDeleteCommand)
export class KeyResultUpdateBulKDeleteHandler
	implements ICommandHandler<KeyResultUpdateBulkDeleteCommand> {
	constructor(
		private readonly keyResultUpdateService: KeyResultUpdateService
	) {}

	public async execute(
		command: KeyResultUpdateBulkDeleteCommand
	): Promise<any> {
		const { id } = command;
		const updates = await this.keyResultUpdateService.findByKeyResultId(id);
		await this.keyResultUpdateService.deleteBulkByKeyResultId(
			updates.map((item) => item.id)
		);
		return;
	}
}
