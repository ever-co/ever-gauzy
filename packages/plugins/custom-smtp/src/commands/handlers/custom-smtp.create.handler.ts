import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ICustomSmtp } from '@gauzy/contracts';
import { CustomSmtpService } from '../../custom-smtp.service';
import { CustomSmtpCreateCommand } from '../custom-smtp.create.command';

@CommandHandler(CustomSmtpCreateCommand)
export class CustomSmtpCreateHandler implements ICommandHandler<CustomSmtpCreateCommand> {

	constructor(
		private readonly _customSmtpService: CustomSmtpService
	) { }

	public async execute(command: CustomSmtpCreateCommand): Promise<ICustomSmtp> {
		try {
			const { input } = command;
			return await this._customSmtpService.create(input);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
