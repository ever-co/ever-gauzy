import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ICreateEmailInvitesOutput } from '@gauzy/contracts';
import { InviteService } from './../../invite.service';
import { InviteBulkCreateCommand } from './../invite.bulk.create.command';

@CommandHandler(InviteBulkCreateCommand)
export class InviteBulkCreateHandler implements ICommandHandler<InviteBulkCreateCommand> {
	constructor(private readonly inviteService: InviteService) {}

	/**
	 * Executes the bulk invite creation command.
	 *
	 * @param command - The InviteBulkCreateCommand containing the input data and language code.
	 * @returns A promise that resolves with the result of the bulk invite creation.
	 */
	public async execute(command: InviteBulkCreateCommand): Promise<ICreateEmailInvitesOutput> {
		const { input, languageCode } = command;
		return await this.inviteService.createBulk(input, languageCode);
	}
}
