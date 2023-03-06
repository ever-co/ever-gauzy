import { ICustomSmtp } from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CustomSmtpService } from '../../custom-smtp.service';
import { CustomSmtpCreateCommand } from '../custom-smtp.create.command';

@CommandHandler(CustomSmtpCreateCommand)
export class CustomSmtpCreateHandler implements ICommandHandler<CustomSmtpCreateCommand> {
	constructor(private readonly customSmtpService: CustomSmtpService) {}

	public async execute(command: CustomSmtpCreateCommand): Promise<ICustomSmtp> {
		const { input } = command;
		try {
			return await this.customSmtpService.create(input);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
