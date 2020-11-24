import { ICustomSmtp } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CustomSmtpService } from '../../custom-smtp.service';
import { CustomSmtpCreateCommand } from '../custom-smtp.create.command';

@CommandHandler(CustomSmtpCreateCommand)
export class CustomSmtpCreateHandler
	implements ICommandHandler<CustomSmtpCreateCommand> {
	constructor(private readonly customSmtpService: CustomSmtpService) {}

	public async execute(
		command: CustomSmtpCreateCommand
	): Promise<ICustomSmtp> {
		const { input } = command;
		delete input['id'];
		return this.customSmtpService.create(input);
	}
}
