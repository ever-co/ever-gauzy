import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ICustomSmtp } from '@gauzy/contracts';
import { CustomSmtpService } from '../../custom-smtp.service';
import { CustomSmtpUpdateCommand } from '../custom-smtp.update.command';

@CommandHandler(CustomSmtpUpdateCommand)
export class CustomSmtpUpdateHandler implements ICommandHandler<CustomSmtpUpdateCommand> {
	constructor(private readonly customSmtpService: CustomSmtpService) {}

	public async execute(command: CustomSmtpUpdateCommand): Promise<ICustomSmtp> {
		try {
			const { input } = command;
			const { id } = input;

			return await this.customSmtpService.create({
				...input,
				id
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
