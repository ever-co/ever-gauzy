import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecoverCamshotCommand } from '../recover-camshot.command';
import { CamshotService } from '../../services/camshot.service';
import { NotFoundException } from '@nestjs/common';
import { ICamshot } from '../../models/camshot.model';

@CommandHandler(RecoverCamshotCommand)
export class RecoverCamshotCommandHandler implements ICommandHandler<RecoverCamshotCommand> {
	constructor(private readonly camshotService: CamshotService) { }

	public async execute(command: RecoverCamshotCommand): Promise<ICamshot> {
		const { id } = command;
		const recovered = await this.camshotService.softRecover(id, {
			withDeleted: true
		});

		if (!recovered) {
			throw new NotFoundException(
				`Camshot with ID '${id}' was not found or could not be recovered. It may not exist, may not be deleted, or there was an issue during the recovery process.`
			);
		}

		return recovered;
	}
}
