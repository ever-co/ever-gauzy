import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SendAuthCodeCommand } from '../send-auth-code.command';
import { AuthService } from '../../auth.service';
import { LanguagesEnum } from '@gauzy/contracts';

@CommandHandler(SendAuthCodeCommand)
export class SendAuthCodeHandler implements ICommandHandler<SendAuthCodeCommand> {

	constructor(
		private readonly authService: AuthService
	) { }

	public async execute(command: SendAuthCodeCommand): Promise<any> {
		try {
			const { input, locale = LanguagesEnum.ENGLISH } = command;
			await this.authService.sendAuthCode(input, locale);
		} finally {
			return new Object({
				status: HttpStatus.OK,
				message: `OK`
			});
		}
	}
}
