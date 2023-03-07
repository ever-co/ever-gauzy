import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmailResetGetCommand } from '../email-reset.get.command';
import { EmailResetService } from './../../email-reset.service';
import { IEmailReset } from '@gauzy/contracts';

@CommandHandler(EmailResetGetCommand)
export class EmailResetGetHandler
	implements ICommandHandler<EmailResetGetCommand> {

	constructor(
		private readonly _emailResetService : EmailResetService
	) {}

	public async execute(
		command: EmailResetGetCommand
	): Promise<IEmailReset> {
		const { input } = command;
		const { email, oldEmail, userId } = input;

		try {
			return await this._emailResetService.findOneByOptions({
				where: {
					email, oldEmail, userId
				},
				order: {
					createdAt: 'DESC'
				}
			});
		} catch (error) {
			throw new NotFoundException(error);
		}
	}
}
