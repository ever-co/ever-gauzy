import { ICustomSmtp } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CustomSmtpService } from '../../custom-smtp.service';
import { CustomSmtpUpdateCommand } from '../custom-smtp.update.command';

@CommandHandler(CustomSmtpUpdateCommand)
export class CustomSmtpUpdateHandler
	implements ICommandHandler<CustomSmtpUpdateCommand> {
	constructor(private readonly customSmtpService: CustomSmtpService) {}

	public async execute(
		command: CustomSmtpUpdateCommand
	): Promise<ICustomSmtp> {
		const { input } = command;
		const { id } = input;
		return this.customSmtpService.create({ id, ...input });
	}
}
