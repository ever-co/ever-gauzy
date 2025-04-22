import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { IEmailHistory } from '@gauzy/contracts';
import { EmailService } from '../../../email-send/email.service';
import { EmailHistoryResendCommand } from '../email-history.resend.command';

@CommandHandler(EmailHistoryResendCommand)
export class EmailHistoryResendHandler implements ICommandHandler<EmailHistoryResendCommand> {
	constructor(private readonly emailService: EmailService) {}

	/**
	 * Executes the EmailHistoryResendCommand to resend an email.
	 *
	 * @param command - The command containing email input and language code.
	 * @returns A promise that resolves with either an UpdateResult or an updated IEmailHistory.
	 */
	public execute(command: EmailHistoryResendCommand): Promise<UpdateResult | IEmailHistory> {
		const { id, input, languageCode } = command;
		return this.emailService.resendEmail(id, input, languageCode);
	}
}
