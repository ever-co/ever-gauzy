import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { LanguagesEnum } from '@gauzy/contracts';
import { SendWorkspaceSigninCodeCommand } from '../send-workspace-signin-code.command';
import { AuthService } from '../../auth.service';

@CommandHandler(SendWorkspaceSigninCodeCommand)
export class SendWorkspaceSigninCodeHandler implements ICommandHandler<SendWorkspaceSigninCodeCommand> {

	constructor(
		private readonly authService: AuthService
	) { }

	public async execute(command: SendWorkspaceSigninCodeCommand): Promise<any> {
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
