import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InviteService } from './../../invite.service';
import { InviteBulkCreateCommand } from './../invite.bulk.create.command';

@CommandHandler(InviteBulkCreateCommand)
export class InviteBulkCreateHandler implements ICommandHandler<InviteBulkCreateCommand> {
	constructor(private readonly inviteService: InviteService) {}

	public async execute(command: InviteBulkCreateCommand) {
		const { input, languageCode } = command;
		return await this.inviteService.createBulk(input, languageCode);
	}
}
